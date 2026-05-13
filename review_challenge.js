const fs = require('fs');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
    const args = process.argv.slice(2);
    const targetTankId = args[0] ? parseInt(args[0]) : null;
    const totalMatches = 10;
    
    if (!targetTankId) {
        console.error("Usage: node review_challenge.js <targetTankId>");
        process.exit(1);
    }

    const report = {
        targetId: targetTankId,
        summary: { total: totalMatches, wins: 0, losses: 0, draws: 0 },
        matches: []
    };

    console.log(`Starting targeted review challenge against Tank ID: ${targetTankId} (${totalMatches} matches)...`);

    for (let i = 1; i <= totalMatches; i++) {
        console.log(`\n[Match ${i}/${totalMatches}] Challenging Tank ${targetTankId}...`);
        try {
            const res = await fetch('https://agentank.ai/api/agent/tank/challenge', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    opponentTankId: targetTankId,
                    mapId: 'classic'
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error(`[Match ${i}] Failed to launch challenge:`, errorText);
                report.matches.push({ matchNum: i, status: 'error', error: errorText });
            } else {
                const matchData = await res.json();
                
                let resultType = "draw";
                if (matchData.winnerTankId === 230) {
                    resultType = "win";
                    report.summary.wins++;
                } else if (matchData.winnerTankId) {
                    resultType = "loss";
                    report.summary.losses++;
                } else {
                    report.summary.draws++;
                }

                const urlId = matchData.urlId || matchData.matchUrlId;
                console.log(`[Match ${i}] Result: ${resultType.toUpperCase()} | Reason: ${matchData.resultReason || matchData.reason} | URL: https://agentank.ai/history/${urlId}`);
                
                report.matches.push({
                    matchNum: i,
                    status: 'success',
                    result: resultType,
                    reason: matchData.resultReason || matchData.reason,
                    matchUrlId: urlId,
                    agentReplayUrl: `https://agentank.ai/api/matches/${urlId}/agent.json`
                });
            }
        } catch (e) {
            console.error(`[Match ${i}] Exception:`, e.message);
            report.matches.push({ matchNum: i, status: 'error', error: e.message });
        }

        if (i < totalMatches) {
            await delay(3000);
        }
    }

    console.log("\n=== Review Challenge Complete ===");
    console.log(`Wins: ${report.summary.wins} | Losses: ${report.summary.losses} | Draws: ${report.summary.draws}`);
    
    fs.writeFileSync('review_report.json', JSON.stringify(report, null, 2));
    console.log("Detailed report saved to review_report.json");
}

main();