const fs = require('fs');
const { execSync } = require('child_process');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
    const totalMatches = 30;
    const baselineWinRate = parseFloat(process.argv[2]) || 0;
    const strategyName = process.argv[3] || 'Optimization';
    
    if (process.argv.length < 3) {
        console.log("Usage: node batch_evolution.js <baselineWinRate> [strategyName]");
        console.log("Example: node batch_evolution.js 0.20 'Anti-Cloak Stance'");
        return;
    }

    console.log(`=== Starting Evolution: ${strategyName} ===`);
    console.log(`Baseline Win Rate: ${(baselineWinRate * 100).toFixed(2)}%`);

    // 1. Publish Code
    console.log("\n[Step 1] Publishing new_tank.js...");
    const code = fs.readFileSync('new_tank.js', 'utf8');
    const pubRes = await fetch('https://agentank.ai/api/agent/tank/code', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            notes: `Evolution: ${strategyName}`,
            submittedBy: "Gemini-Evolution-Bot"
        })
    });
    
    if (!pubRes.ok) {
        console.error("Publish failed:", await pubRes.text());
        return;
    }
    console.log("Publish success.");
    await delay(2000);

    // 2. Run Battles
    const report = {
        summary: { total: 0, wins: 0, losses: 0, draws: 0 },
        matches: []
    };

    let myTankId = null;

    for (let i = 1; i <= totalMatches; i++) {
        console.log(`[Match ${i}/${totalMatches}] Challenging...`);
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
                console.error(`Match ${i} failed:`, await res.text());
                continue;
            }

            const matchData = await res.json();
            if (!myTankId) myTankId = matchData.challengerTankId || matchData.attackerTankId; // 动态获取当前坦克ID

            report.summary.total++;
            let resultType = "draw";
            if (matchData.winnerTankId === myTankId || matchData.winner === "XDB") {
                resultType = "win";
                report.summary.wins++;
            } else if (matchData.winnerTankId) {
                resultType = "loss";
                report.summary.losses++;
                
                // 自动下载失败录像进行深度分析
                const urlId = matchData.urlId || matchData.matchUrlId;
                const replayFilename = `batch_evolution_replays/loss_${i}_${matchData.defenderTankName}_${urlId}.json`;
                console.log(`Downloading replay for loss: ${urlId}...`);
                try {
                    const replayRes = await fetch(`https://agentank.ai/api/matches/${urlId}/agent.json`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (replayRes.ok) {
                        const replayJson = await replayRes.json();
                        fs.writeFileSync(replayFilename, JSON.stringify(replayJson, null, 2));
                    }
                } catch (e) { console.error("Replay download failed:", e.message); }
            } else {
                report.summary.draws++;
            }
            
            console.log(`Result: ${resultType.toUpperCase()} | VS: ${matchData.defenderTankName || "Bot"}`);
            
            report.matches.push({
                matchNum: i,
                result: resultType,
                matchUrlId: matchData.urlId || matchData.matchUrlId,
                opponent: matchData.defenderTankName
            });

        } catch (e) {
            console.error(`Exception in match ${i}:`, e.message);
        }

        if (i < totalMatches) await delay(3000);
    }

    // 3. Evaluate
    const currentWinRate = report.summary.wins / report.summary.total;
    const diff = currentWinRate - baselineWinRate;
    
    console.log("\n=== Evolution Result ===");
    console.log(`Current Win Rate: ${(currentWinRate * 100).toFixed(2)}%`);
    console.log(`Improvement: ${(diff * 100).toFixed(2)}%`);

    fs.writeFileSync('evolution_report.json', JSON.stringify(report, null, 2));

    if (diff >= 0.10) {
        console.log("\n[Result] SIGNIFICANT IMPROVEMENT (>= 10%)! Committing and Pushing...");
        try {
            execSync('git add new_tank.js STRATEGY.md batch_evolution.js');
            execSync(`git commit -m "feat: ${strategyName} (Win rate: ${(currentWinRate * 100).toFixed(0)}%)"`);
            execSync('git push');
            console.log("Git sync complete.");
        } catch (e) {
            console.error("Git command failed:", e.message);
        }
    } else if (diff > -0.05) {
        console.log("\n[Result] FLUCTUATION ZONE (-5% to 10%). Retaining code for further analysis, no commit.");
        console.log("Recommend running another batch of battles to accumulate more data.");
    } else {
        console.log("\n[Result] PERFORMANCE DROP (<= -5%). Reverting changes...");
        try {
            execSync('git restore new_tank.js');
            console.log("Rollback complete.");
        } catch (e) {
            console.error("Git restore failed:", e.message);
        }
    }
}

main();
