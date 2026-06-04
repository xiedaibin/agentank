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

    const bots = ['nova-scout', 'azure-hunter', 'crimson-bastion'];
    const matchesPerBot = 10;
    const totalMatches = bots.length * matchesPerBot;

    console.log(`\n=============================================================`);
    console.log(`🚀 Starting V12.39 30-Match Validation Suite (Simulation Mode)`);
    console.log(`=============================================================`);
    console.log(`Challenging: ${bots.join(', ')} (${matchesPerBot} matches each)`);
    console.log(`Local Code: new_tank.js\n`);

    const code = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');

    const summary = {
        total: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        botStats: {},
        reasons: {},
        triggers: {
            "V12.39: LoS Penalty": 0,
            "Ghost Evasion": 0,
            "SO: Evasion": 0,
            "LoS: Close Danger": 0
        }
    };

    bots.forEach(b => {
        summary.botStats[b] = { wins: 0, losses: 0, draws: 0 };
    });

    let matchCount = 0;

    for (const botId of bots) {
        console.log(`\n--- Testing against: ${botId} ---`);
        for (let i = 1; i <= matchesPerBot; i++) {
            matchCount++;
            process.stdout.write(`[Match ${matchCount}/${totalMatches}] vs ${botId}... `);
            try {
                const res = await fetch('https://agentank.ai/api/agent/tank/simulate', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        code: code,
                        opponentId: botId,
                        mapId: 'classic'
                    })
                });

                if (!res.ok) {
                    console.log(`Failed (HTTP ${res.status}) - ${await res.text()}`);
                    await delay(2500);
                    continue;
                }

                const data = await res.json();
                const winner = data.winner; // 'me', 'opponent', 'draw'
                const reason = data.resultReason || 'unknown';

                // Update summary
                summary.total++;
                summary.reasons[reason] = (summary.reasons[reason] || 0) + 1;

                if (winner === 'me') {
                    summary.wins++;
                    summary.botStats[botId].wins++;
                    console.log(`WIN (${reason})`);
                } else if (winner === 'opponent') {
                    summary.losses++;
                    summary.botStats[botId].losses++;
                    console.log(`LOSS (${reason})`);
                } else {
                    summary.draws++;
                    summary.botStats[botId].draws++;
                    console.log(`DRAW (${reason})`);
                }

                // Analyze Replay Records for Speech Triggers
                const replay = data.replayData || data;
                if (replay.replay && replay.replay.records) {
                    const records = replay.replay.records;
                    const matchTriggers = new Set();
                    for (let f = 0; f < records.length; f++) {
                        const frameEvents = records[f] || [];
                        for (const ev of frameEvents) {
                            if (ev.type === 'speech' && ev.by === 0 && ev.text) {
                                const text = ev.text;
                                if (summary.triggers.hasOwnProperty(text)) {
                                    summary.triggers[text]++;
                                    matchTriggers.add(text);
                                }
                            }
                        }
                    }
                    if (matchTriggers.size > 0) {
                        console.log(`    ↳ Triggers in this match: ${Array.from(matchTriggers).join(', ')}`);
                    }
                }

            } catch (e) {
                console.log(`Error: ${e.message}`);
            }

            if (matchCount < totalMatches) {
                await delay(2500); // 2-second rate limit with buffer
            }
        }
    }

    const totalWR = ((summary.wins / summary.total) * 100).toFixed(1);

    console.log(`\n=============================================================`);
    console.log(`📊 30-MATCH VALIDATION SUMMARY (V12.39)`);
    console.log(`=============================================================`);
    console.log(`Overall Record: ${summary.wins} Wins | ${summary.losses} Losses | ${summary.draws} Draws`);
    console.log(`Overall Win Rate: ${totalWR}%\n`);

    console.log(`🤖 Win Rate Per Bot:`);
    bots.forEach(b => {
        const botTotal = summary.botStats[b].wins + summary.botStats[b].losses + summary.botStats[b].draws;
        const botWR = botTotal > 0 ? ((summary.botStats[b].wins / botTotal) * 100).toFixed(1) : '0.0';
        console.log(`  - ${b}: ${summary.botStats[b].wins}/${botTotal} wins (${botWR}%)`);
    });

    console.log(`\n💬 Visual Speech Debugging Triggers (Total across 30 matches):`);
    Object.keys(summary.triggers).forEach(key => {
        console.log(`  - "${key}": triggered ${summary.triggers[key]} times`);
    });

    console.log(`\n☠️ End-of-Match Reasons:`);
    Object.keys(summary.reasons).forEach(r => {
        console.log(`  - ${r}: ${summary.reasons[r]} matches`);
    });
    console.log(`=============================================================`);
}

main();
