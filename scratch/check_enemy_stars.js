const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    
    // We send a minimal code that prints the keys of enemy and enemy.tank
    const testCode = `
function onIdle(me, enemy, game) {
    if (game.frames === 0) {
        print("--- RUNTIME INSPECTION ---");
        print("enemy keys: " + Object.keys(enemy).join(", "));
        if (enemy.tank) {
            print("enemy.tank keys: " + Object.keys(enemy.tank).join(", "));
        }
        print("enemy.stars: " + enemy.stars);
        print("enemy.stars type: " + typeof enemy.stars);
    }
    me.go();
}
`;

    console.log("Sending simulation request...");
    const res = await fetch('https://agentank.ai/api/agent/tank/simulate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            opponentId: 'nova-scout',
            mapId: 'classic',
            code: testCode
        })
    });
    
    if (!res.ok) {
        console.error("Simulation failed:", res.status, await res.text());
        return;
    }
    
    const data = await res.json();
    console.log("Simulation success! Parsing logs...");
    
    // In the raw replay, records can contain console output or printed lines.
    // Let's search the response for our prints.
    const logs = [];
    if (data.replayData && data.replayData.replay && data.replayData.replay.records) {
        const records = data.replayData.replay.records;
        for (let f = 0; f < records.length; f++) {
            const events = records[f] || [];
            for (const ev of events) {
                // In some versions of the replay data, print calls are recorded as events
                if (ev.type === 'print' || ev.action === 'print' || ev.text) {
                    logs.push(`Frame ${f}: ${ev.text || ev.message || JSON.stringify(ev)}`);
                }
            }
        }
    }
    
    // Let's also check if there is a separate logs array in the players section
    if (data.replayData && data.replayData.replay && data.replayData.replay.meta && data.replayData.replay.meta.players) {
        const players = data.replayData.replay.meta.players;
        players.forEach((p, idx) => {
            console.log(`Player ${idx} (${p.tank ? p.tank.id : 'unknown'}): runTime=${p.runTime}`);
            if (p.logs) {
                console.log(`Player ${idx} logs:`, p.logs);
            }
        });
    }

    console.log("Found printed logs:");
    console.log(logs.join('\n'));
    
    // Write full response to scratch/sim_result.json for reference
    fs.writeFileSync('scratch/sim_result.json', JSON.stringify(data, null, 2));
    console.log("Full simulation result saved to scratch/sim_result.json");
}

main();
