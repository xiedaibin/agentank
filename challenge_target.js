const fs = require('fs');
const path = require('path');
const { getToken } = require('./config');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }
    const targetInput = process.argv[2];

    const matches = parseInt(process.argv[3]) || 10;
    const replayDir = 'batch_evolution_replays';

    if (!targetInput) {
        console.log("用法: node challenge_target.js <tank_id_or_bot_name> [场次]");
        return;
    }

    if (!fs.existsSync(replayDir)) fs.mkdirSync(replayDir);

    console.log(`[系统] 正在验证目标 [${targetInput}]...`);

    // 1. 获取基础信息
    let myTankId = null;
    let trainingBots = [];
    try {
        const meRes = await fetch('https://agentank.ai/api/agent/tank', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const meData = await meRes.json();
        myTankId = meData.tank.id;
        trainingBots = meData.trainingBots || [];
    } catch (e) {
        console.error("❌ 无法连接服务器获取坦克信息:", e.message);
        return;
    }

    // 2. 解析目标
    let targetBot = trainingBots.find(b => b.id === targetInput || b.name === targetInput);
    let targetTankId = /^\d+$/.test(targetInput) ? parseInt(targetInput) : null;
    let useSimulate = !!targetBot;

    if (!targetBot && !targetTankId) {
        // 尝试搜索玩家坦克
        console.log(`[系统] 正在搜索名为 [${targetInput}] 的玩家坦克...`);
        try {
            const searchRes = await fetch(`https://agentank.ai/api/agent/opponents?q=${encodeURIComponent(targetInput)}&limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const searchData = await searchRes.json();
            if (searchData.opponents && searchData.opponents.length > 0) {
                targetTankId = searchData.opponents[0].id;
                console.log(`✅ 找到玩家坦克: ${searchData.opponents[0].name} (ID: ${targetTankId})`);
            }
        } catch (e) {}
    }

    if (!targetBot && !targetTankId) {
        console.error(`❌ 错误: 未能找到目标 [${targetInput}]。请确认是机器人名称 (如 azure-hunter) 或玩家 ID (如 923)。`);
        return;
    }

    const opponentDisplayName = targetBot ? targetBot.name : `玩家 ${targetTankId}`;
    console.log(`\n=== 启动专项测试: 目标 [${opponentDisplayName}]，方式 [${useSimulate ? '模拟' : '实战'}]，场次 [${matches}] ===`);

    let wins = 0;
    for (let i = 1; i <= matches; i++) {
        process.stdout.write(`[场次 ${i}/${matches}] 对战中... `);
        try {
            let res;
            if (useSimulate) {
                res = await fetch('https://agentank.ai/api/agent/tank/simulate', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ opponentId: targetBot.id, mapId: 'classic' })
                });
            } else {
                res = await fetch('https://agentank.ai/api/agent/tank/challenge', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ opponentTankId: targetTankId, mapId: 'classic' })
                });
            }

            if (!res.ok) {
                console.log(`失败 (HTTP ${res.status})`);
                await delay(2000);
                continue;
            }

            const data = await res.json();
            let isWin = false;
            let replayData = null;
            let urlId = data.urlId || data.matchUrlId || `sim_${Date.now()}`;

            if (useSimulate) {
                isWin = (data.winner === 'me');
                replayData = data.replayData || data;
            } else {
                isWin = (data.winnerTankId === myTankId);
                // 实战模式下通常需要单独下载录像，但由于 simulate 已经包含了 replayData，
                // 我们在 challenge 失败时尝试下载
                if (!isWin) {
                    const repRes = await fetch(`https://agentank.ai/api/matches/${urlId}/agent.json`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (repRes.ok) replayData = await repRes.json();
                }
            }

            if (isWin) {
                wins++;
                console.log(`胜利 (WIN)`);
            } else {
                console.log(`失败 (LOSS)`);
                if (replayData) {
                    const opponentName = (data.opponentName || data.defenderTankName || targetInput).replace(/[\\/:*?"<>|]/g, '_');
                    fs.writeFileSync(`${replayDir}/target_loss_${i}_${opponentName}_${urlId}.json`, JSON.stringify(replayData, null, 2));
                }
            }
        } catch (e) {
            console.log(`异常: ${e.message}`);
        }
        await delay(2000); 
    }

    const finalWR = (wins / matches * 100).toFixed(2);
    console.log(`\n=== 测试结束: 胜率 ${finalWR}% (${wins}/${matches}) ===`);
}

main();
