const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getToken } = require('./config');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 清理旧录像
function clearReplays(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        return;
    }
    const files = fs.readdirSync(dir);
    for (const file of files) {
        fs.unlinkSync(path.join(dir, file));
    }
    console.log(`[系统] 已清理目录 ${dir} 下的 ${files.length} 个旧录像。`);
}

// 获取当前代码版本
function getVersion() {
    const code = fs.readFileSync('new_tank.js', 'utf8');
    const match = code.match(/Strategic Assassin V(\d+)/);
    return match ? `V${match[1]}` : "Unknown";
}

// 从日志获取最近一次采用的胜率作为基准
function getLatestAdoptedWinRate() {
    if (!fs.existsSync('EVOLUTION_LOG.md')) return 0;
    const content = fs.readFileSync('EVOLUTION_LOG.md', 'utf8');
    const lines = content.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const parts = lines[i].split('|');
        if (parts.length > 6 && parts[6].trim() === 'Adopted') {
            const wr = parseFloat(parts[5].replace('%', '')) / 100;
            return wr;
        }
    }
    return 0;
}

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }
    const totalMatches = 30;

    
    let baselineWinRate = parseFloat(process.argv[2]);
    if (isNaN(baselineWinRate)) {
        baselineWinRate = getLatestAdoptedWinRate();
        console.log(`[自动基准] 未提供基准，使用最近一次采用的胜率: ${(baselineWinRate * 100).toFixed(2)}%`);
    }

    const strategyName = process.argv[3] || '未命名策略';
    const currentVersion = getVersion();
    const replayDir = 'batch_evolution_replays';
    
    if (process.argv.length < 3 && !baselineWinRate) {
        console.log("用法: node batch_evolution.js <基准胜率> [策略名称]");
        return;
    }

    console.log(`\n=== 启动进化流程: ${currentVersion} - ${strategyName} ===`);
    console.log(`目标基准胜率: ${(baselineWinRate * 100).toFixed(2)}%`);

    // 0. 清理
    clearReplays(replayDir);

    const code = fs.readFileSync('new_tank.js', 'utf8');

    // 1. 发布前自检 (Simulation)
    console.log("\n[第一步] 执行代码自检 (模拟运行)...");
    const simRes = await fetch('https://agentank.ai/api/agent/tank/simulate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            opponentId: 'nova-scout', // 使用基础机器人进行语法和逻辑自检
            mapId: 'classic'
        })
    });

    if (!simRes.ok) {
        const errorText = await simRes.text();
        console.error("❌ 自检失败 (代码存在语法或运行错误):", errorText);
        process.exit(1);
    }
    console.log("✅ 自检通过。代码可以正常运行。");
    await delay(1000);

    // 2. 正式发布
    console.log("\n[第二步] 发布新版本代码...");
    const pubRes = await fetch('https://agentank.ai/api/agent/tank/code', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            notes: `自动化进化: ${strategyName}`,
            submittedBy: "Gemini-Auto-Evolution"
        })
    });
    
    if (!pubRes.ok) {
        console.error("❌ 发布失败:", await pubRes.text());
        return;
    }
    console.log("✅ 发布成功。");
    await delay(2000);

    // 3. 开始对战
    console.log(`\n[第三步] 开始 ${totalMatches} 场批量对战...`);
    const report = {
        summary: { total: 0, wins: 0, losses: 0, draws: 0 },
        matches: []
    };

    let myTankId = null;

    for (let i = 1; i <= totalMatches; i++) {
        process.stdout.write(`[场次 ${i}/${totalMatches}] 对战中... `);
        try {
            const res = await fetch('https://agentank.ai/api/agent/tank/challenge', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ randomOpponent: true, mapId: 'classic' })
            });

            if (!res.ok) {
                console.log(`失败 (HTTP ${res.status})`);
                continue;
            }

            const matchData = await res.json();
            if (!myTankId) myTankId = matchData.challengerTankId || matchData.attackerTankId;

            report.summary.total++;
            let resultType = "draw";
            if (matchData.winnerTankId === myTankId || matchData.winner === "XDB") {
                resultType = "win";
                report.summary.wins++;
            } else if (matchData.winnerTankId) {
                resultType = "loss";
                report.summary.losses++;
                
                // 保存失败录像
                const urlId = matchData.urlId || matchData.matchUrlId;
                const replayFilename = `${replayDir}/loss_${i}_${(matchData.defenderTankName || "Bot").replace(/[\\/:*?"<>|]/g, '_')}_${urlId}.json`;
                try {
                    const replayRes = await fetch(`https://agentank.ai/api/matches/${urlId}/agent.json`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (replayRes.ok) {
                        const replayJson = await replayRes.json();
                        fs.writeFileSync(replayFilename, JSON.stringify(replayJson, null, 2));
                    }
                } catch (e) { }
            } else {
                report.summary.draws++;
            }
            
            console.log(`${resultType.toUpperCase()} | 对手: ${matchData.defenderTankName || "Bot"}`);
            
            report.matches.push({
                matchNum: i,
                result: resultType,
                matchUrlId: matchData.urlId || matchData.matchUrlId,
                opponent: matchData.defenderTankName
            });

        } catch (e) {
            console.log(`异常: ${e.message}`);
        }

        if (i < totalMatches) await delay(3000);
    }

    // 4. 评估与记录
    const currentWinRate = report.summary.wins / report.summary.total;
    const diff = currentWinRate - baselineWinRate;
    const date = new Date().toISOString().split('T')[0];
    const status = diff >= 0.10 ? "Adopted" : (diff > -0.05 ? "Pending" : "Rejected");
    
    console.log("\n=== 进化结果评估 ===");
    console.log(`当前胜率: ${(currentWinRate * 100).toFixed(2)}%`);
    console.log(`胜率提升: ${(diff * 100).toFixed(2)}%`);

    fs.writeFileSync('evolution_report.json', JSON.stringify(report, null, 2));

    // 自动更新进化日志 (EVOLUTION_LOG.md)
    const logEntry = `| ${currentVersion} | ${date} | ${strategyName} | ${strategyName} (自动生成) | ${(currentWinRate * 100).toFixed(2)}% | ${status} | ${(diff * 100).toFixed(2)}% |\n`;
    fs.appendFileSync('EVOLUTION_LOG.md', logEntry);

    if (diff >= 0.10) {
        console.log("\n[决策] 显著提升! 自动提交并推送代码...");
        try {
            execSync('git add new_tank.js STRATEGY.md batch_evolution.js EVOLUTION_LOG.md');
            execSync(`git commit -m "feat: ${currentVersion} ${strategyName} (胜率: ${(currentWinRate * 100).toFixed(0)}%)"`);
            execSync('git push');
            console.log("✅ Git 同步完成。");
        } catch (e) {
            console.error("❌ Git 操作失败:", e.message);
        }
    } else if (diff > -0.05) {
        console.log("\n[决策] 胜率波动，保留代码进一步分析。");
    } else {
        console.log("\n[决策] 性能下降，自动回滚至上一版本...");
        try {
            execSync('git restore new_tank.js');
            console.log("✅ 回滚完成。");
        } catch (e) {
            console.error("❌ 回滚失败:", e.message);
        }
    }
}

main();
