const fs = require('fs');
const { getToken } = require('../config');

const code = `
let first = true;
function onIdle(me, enemy, game) {
    if (first) {
        first = false;
        me.speak("Keys:" + Object.keys(game).join(","));
    }
}`;

async function main() {
    const token = getToken();
    const url = 'https://agentank.ai/api/agent/tank/simulate';
    
    try {
        console.log("Running sandbox inspection simulation...");
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                opponentId: 'nova-scout',
                mapId: 'classic',
                code: code
            })
        });
        
        if (!res.ok) {
            console.error(`Failed to simulate: ${res.status} ${await res.text()}`);
            return;
        }
        
        const data = await res.json();
        const records = data.replayData && data.replayData.replay && data.replayData.replay.records ? data.replayData.replay.records : [];
        
        records.forEach((frameEvents, idx) => {
            frameEvents.forEach(evt => {
                if (evt.action === 'say' || evt.type === 'speech') {
                    console.log(`[Frame ${idx}] Speak: "${evt.text}"`);
                }
            });
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
