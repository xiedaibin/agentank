const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    const opponentId = process.argv[2] || 'nova-scout';
    const totalMatches = parseInt(process.argv[3]) || 10;
    const replayDir = path.join(__dirname, 'replays');

    if (!fs.existsSync(replayDir)) {
        fs.mkdirSync(replayDir);
    }

    console.log(`\n=== Starting Batch Simulation: XDB vs ${opponentId} (${totalMatches} matches) ===`);
    const code = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');

    const summary = { wins: 0, losses: 0, draws: 0, reasons: {} };

    for (let i = 1; i <= totalMatches; i++) {
        process.stdout.write(`[Match ${i}/${totalMatches}] Running... `);
        try {
            const res = await fetch('https://agentank.ai/api/agent/tank/simulate', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: code,
                    opponentId: opponentId,
                    mapId: 'classic'
                })
            });

            if (!res.ok) {
                console.log(`Failed (HTTP ${res.status}) - ${await res.text()}`);
                await delay(2500);
                continue;
            }

            const data = await res.json();
            const winner = data.winner; // 'me', 'opponent', or 'draw'
            const reason = data.resultReason || 'unknown';

            if (winner === 'me') {
                summary.wins++;
                console.log(`WIN (${reason})`);
            } else if (winner === 'opponent') {
                summary.losses++;
                console.log(`LOSS (${reason})`);
                // Save loss replay
                const filename = path.join(replayDir, `loss_${opponentId}_match_${i}_${reason}.json`);
                fs.writeFileSync(filename, JSON.stringify(data.replayData || data, null, 2));
            } else {
                summary.draws++;
                console.log(`DRAW (${reason})`);
            }

            summary.reasons[reason] = (summary.reasons[reason] || 0) + 1;

        } catch (e) {
            console.log(`Error: ${e.message}`);
        }

        if (i < totalMatches) {
            await delay(2500); // 2-second rate limit
        }
    }

    const winRate = ((summary.wins / totalMatches) * 100).toFixed(1);
    console.log(`\n=== Simulation Complete ===`);
    console.log(`Wins: ${summary.wins} | Losses: ${summary.losses} | Draws: ${summary.draws}`);
    console.log(`Win Rate: ${winRate}%`);
    console.log(`Reasons Summary:`, summary.reasons);
}

main();
