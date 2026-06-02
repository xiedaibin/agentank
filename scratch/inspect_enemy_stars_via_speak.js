const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    
    // We use me.speak to leak runtime values into replay events
    const testCode = `
function onIdle(me, enemy, game) {
    if (game.frames === 0) {
        var msg = "e.stars:" + (enemy ? enemy.stars : "no_enemy");
        me.speak(msg);
    }
    me.go();
}
`;

    console.log("Sending simulation request with speak...");
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
    console.log("Simulation success! Searching events for speech...");
    
    let foundSpeech = null;
    if (data.replayData && data.replayData.replay && data.replayData.replay.records) {
        const records = data.replayData.replay.records;
        for (let f = 0; f < records.length; f++) {
            const events = records[f] || [];
            for (const ev of events) {
                if (ev.type === 'speak' || ev.action === 'speak' || ev.text) {
                    console.log(`Found event at Frame ${f}:`, ev);
                    foundSpeech = ev;
                }
            }
        }
    }
    
    if (!foundSpeech) {
        console.log("No speech events found in replay records. Saving response to scratch/sim_speak_result.json for review.");
        fs.writeFileSync('scratch/sim_speak_result.json', JSON.stringify(data, null, 2));
    }
}

main();
