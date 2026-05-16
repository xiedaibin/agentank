const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
const replayDir = 'targeted_evolution_replays';

// --- 工具函数 ---
function clearDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        return;
    }
    fs.readdirSync(dir).forEach(f => {
        try { fs.unlinkSync(path.join(dir, f)); } catch(e) {}
    });
}

async function runMatches(targetId, count, mode = 'challenge') {
    let wins = 0;
    const results = [];
    console.log(`\n[开始] 发起 ${count} 场对战 (目标: ${targetId}, 模式: ${mode})...`);
    
    for (let i = 1; i <= count; i++) {
        process.stdout.write(`[${i}/${count}] 对战中... `);
        try {
            const body = (mode === 'simulate' || targetId === 'nova-scout')
                ? { opponentId: targetId, mapId: 'classic' }
                : { opponentTankId: parseInt(targetId), mapId: 'classic' };
            
            const endpoint = (mode === 'simulate' || targetId === 'nova-scout') ? 'simulate' : 'challenge';
            
            const res = await fetch(`https://agentank.ai/api/agent/tank/${endpoint}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                console.log(`跳过 (HTTP ${res.status})`);
                await delay(2000);
                continue;
            }

            const data = await res.json();
            const urlId = data.urlId || data.matchUrlId || `sim_${Date.now()}`;
            const isWin = (endpoint === 'simulate') ? (data.winner === 'me') : (data.winnerTankId === 230);

            if (isWin) {
                wins++;
                console.log("WIN");
            } else {
                console.log("LOSS");
                try {
                    const repRes = await fetch(`https://agentank.ai/api/matches/${urlId}/agent.json`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (repRes.ok) {
                        const replay = await repRes.json();
                        fs.writeFileSync(`${replayDir}/loss_${targetId}_${urlId}.json`, JSON.stringify(replay, null, 2));
                    }
                } catch (e) {}
            }
            results.push({ i, isWin, urlId });
        } catch (e) {
            console.log(`异常: ${e.message}`);
        }
        await delay(2500);
    }
    return { wins, total: results.length, rate: wins / results.length };
}

async function main() {
    const targetId = process.argv[2];
    const strategyName = process.argv[3] || 'Targeted_Optimization';
    
    if (!targetId) {
        console.log("用法: node targeted_evolution.js <tankId> [策略名]");
        return;
    }

    clearDir(replayDir);

    console.log("\n=== 第一阶段: 基准评估 ===");
    let baselineWR = 0.80; // 默认基准
    try {
        const log = fs.readFileSync('EVOLUTION_LOG.md', 'utf8');
        const matches = log.match(/\| \d+\.\d+%\s+\| Adopted/g);
        if (matches) baselineWR = parseFloat(matches[matches.length - 1].split('|')[1]) / 100;
    } catch (e) {}
    console.log(`基准胜率: ${(baselineWR * 100).toFixed(2)}%`);

    console.log(`\n=== 第二阶段: 专项挑战目标 [${targetId}] (20场) ===`);
    const targetedResult = await runMatches(targetId, 20);
    const currentWR = (targetedResult.rate * 100).toFixed(2);
    console.log(`\n专项测试胜率: ${currentWR}% (${targetedResult.wins}/${targetedResult.total})`);

    if (targetedResult.rate < 0.8) {
        console.log(`\n❌ 未达标 (目标 80%)。自动运行深度分析...`);
        try {
            const analysis = execSync(`node analyze_skill_interactions.js ${replayDir}`).toString();
            console.log(analysis);
        } catch (e) {
            console.log("分析脚本运行失败: " + e.message);
        }
        process.exit(2);
    }

    console.log(`\n✅ 专项达标! 进入第三阶段: 基准校验 (防止过度特化)...`);
    
    async function runRandom(count) {
        let wins = 0;
        for (let i = 1; i <= count; i++) {
            process.stdout.write(`[随机 ${i}/${count}] 对战中... `);
            try {
                const res = await fetch('https://agentank.ai/api/agent/tank/challenge', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ randomOpponent: true, mapId: 'classic' })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.winnerTankId === 230) {
                        wins++;
                        console.log("WIN");
                    } else {
                        console.log("LOSS");
                    }
                } else {
                    console.log("跳过");
                }
            } catch (e) { console.log("异常"); }
            await delay(3000);
        }
        return wins / count;
    }
    
    const newBenchmarkWR = await runRandom(30);
    const diff = newBenchmarkWR - baselineWR;
    console.log(`\n新基准胜率: ${(newBenchmarkWR * 100).toFixed(2)}% (偏差: ${(diff * 100).toFixed(2)}%)`);

    if (diff < -0.05) {
        console.log("\n❌ 警告: 全局表现下降超过 5%! 自动回滚代码。");
        execSync('git restore new_tank.js');
        process.exit(3);
    }

    console.log("\n🏆 进化成功! 专项与基准均通过。正在存档...");
    const entry = `| V_Auto | ${new Date().toISOString().split('T')[0]} | ${strategyName} | 专项达标(${currentWR}%)并校验通过 | ${(newBenchmarkWR * 100).toFixed(2)}% | Adopted | ${(diff * 100).toFixed(2)}% |\n`;
    fs.appendFileSync('EVOLUTION_LOG.md', entry);
    execSync(`git add new_tank.js EVOLUTION_LOG.md && git commit -m "feat: 专项优化 [${targetId}] 达标 ${currentWR}%"`);
}

main();
