const fs = require('fs');
const path = require('path');

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

async function main() {
    const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
    const arg = process.argv[2];
    const isInfinite = arg === 'infinite' || !arg;
    const maxMatches = isInfinite ? Infinity : parseInt(arg);
    const replayDir = 'rank_replays';
    
    if (!isInfinite && (isNaN(maxMatches) || maxMatches <= 0)) {
        console.log("用法: node ranked_battle.js [次数|infinite]");
        return;
    }

    console.log(`\n⚔️  启动排位挂机系统...`);
    console.log(`模式: ${isInfinite ? '无限循环' : `对战 ${maxMatches} 场`}`);
    console.log(`提示: 按 Ctrl+C 或在 CLI 中停止进程以退出。`);

    // 0. 清理旧录像
    clearReplays(replayDir);

    let stats = { wins: 0, losses: 0, total: 0 };
    let myTankId = 230;

    // 获取初始 ID
    try {
        const meRes = await fetch('https://agentank.ai/api/agent/tank', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const meData = await meRes.json();
        myTankId = meData.tank.id;
        console.log(`✅ 坦克已就绪: ${meData.tank.name} (ID: ${myTankId}) | 当前分分数: ${meData.tank.rankScore}`);
    } catch (e) {
        console.warn("[警告] 无法获取初始信息，使用默认配置继续...");
    }

    while (stats.total < maxMatches) {
        stats.total++;
        process.stdout.write(`\r[场次 ${stats.total}${isInfinite ? '' : `/${maxMatches}`}] 正在寻找对手... `);

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
                await delay(5000);
                continue;
            }

            const data = await res.json();
            const isWin = (data.winnerTankId === myTankId || data.winner === 'XDB');
            if (isWin) {
                stats.wins++;
            } else {
                stats.losses++;
                // 保存失败录像
                const urlId = data.urlId || data.matchUrlId;
                if (urlId) {
                    const opponentName = (data.defenderTankName || 'Unknown').replace(/[\\/:*?"<>|]/g, '_');
                    const replayFilename = path.join(replayDir, `loss_${stats.total}_${opponentName}_${urlId}.json`);
                    try {
                        const replayRes = await fetch(`https://agentank.ai/api/matches/${urlId}/agent.json`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (replayRes.ok) {
                            const replayJson = await replayRes.json();
                            fs.writeFileSync(replayFilename, JSON.stringify(replayJson, null, 2));
                        }
                    } catch (e) {
                        // 录像抓取失败不中断流程
                    }
                }
            }

            const resultStr = isWin ? '🏆 胜利 (WIN)' : '💀 失败 (LOSS)';
            const opponent = data.defenderTankName || '未知坦克';
            const scoreChange = data.rankChanges ? data.rankChanges.find(c => c.tankId === myTankId)?.delta || 0 : 0;

            process.stdout.write(`${resultStr} | 对手: ${opponent} | 积分变动: ${scoreChange >= 0 ? '+' : ''}${scoreChange} | 实时胜率: ${(stats.wins / stats.total * 100).toFixed(1)}%\n`);

        } catch (e) {
            console.log(`异常: ${e.message}`);
        }

        // 遵守 API 2秒限制，这里设为 3秒
        await delay(3000);
    }

    console.log(`\n=== 挂机任务结束 ===`);
    console.log(`总对战: ${stats.total} | 胜利: ${stats.wins} | 失败: ${stats.losses} | 最终胜率: ${(stats.wins / stats.total * 100).toFixed(2)}%`);
}

main();

