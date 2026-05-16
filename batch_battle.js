const fs = require('fs');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
    const totalMatches = parseInt(process.argv[2]) || 10;
    const report = {
        summary: { total: totalMatches, wins: 0, losses: 0, draws: 0 },
        matches: []
    };

    console.log(`Starting batch of ${totalMatches} matches...`);

    for (let i = 1; i <= totalMatches; i++) {
        console.log(`\n[Match ${i}/${totalMatches}] Initiating challenge...`);
        try {
            const res = await fetch('https://agentank.ai/api/agent/tank/challenge', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    randomOpponent: true,
                    mapId: 'classic' // Stick to classic map for consistent tactical evaluation
                })
            });

            if (!res.ok) {
                console.error(`[Match ${i}] Failed to launch challenge:`, await res.text());
                report.matches.push({ matchNum: i, status: 'error', error: 'API request failed' });
            } else {
                const matchData = await res.json();
                let resultType = "draw";
                if (matchData.winnerTankId === 230 || matchData.winnerTankName === "XDB" || matchData.winner === "XDB") {
                    resultType = "win";
                    report.summary.wins++;
                } else if (matchData.winnerTankId || matchData.winnerTankName || matchData.winner) {
                    resultType = "loss";
                    report.summary.losses++;
                } else {
                    report.summary.draws++;
                }

                const urlId = matchData.urlId || matchData.matchUrlId;
                const reason = matchData.resultReason || matchData.reason;
                console.log(`[Match ${i}] Result: ${resultType.toUpperCase()} | Reason: ${reason} | URL: https://agentank.ai/history/${urlId}`);
                
                report.matches.push({
                    matchNum: i,
                    status: 'success',
                    result: resultType,
                    reason: reason,
                    matchUrlId: urlId,
                    opponent: matchData.defenderTankName || "Unknown",
                    opponentTankId: matchData.defenderTankId,
                    winnerTankId: matchData.winnerTankId,
                    winnerTankName: matchData.winnerTankName,
                    agentReplayUrl: `https://agentank.ai/api/matches/${urlId}/agent.json`
                });
            }
        } catch (e) {
            console.error(`[Match ${i}] Exception:`, e.message);
            report.matches.push({ matchNum: i, status: 'error', error: e.message });
        }

        // Wait 3 seconds to strictly respect the 2-second rate limit
        if (i < totalMatches) {
            console.log(`Waiting 3 seconds for cooldown...`);
            await delay(3000);
        }
    }

    console.log("\n=== Batch Complete ===");
    console.log(`Wins: ${report.summary.wins} | Losses: ${report.summary.losses} | Draws: ${report.summary.draws}`);
    
    fs.writeFileSync('battle_report.json', JSON.stringify(report, null, 2));
    console.log("Detailed report saved to battle_report.json");
}

main();
