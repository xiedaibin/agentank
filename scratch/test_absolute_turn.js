const fs = require('fs');
const { getToken } = require('../config');

async function testAbsoluteTurn() {
    const token = getToken();
    if (!token) {
        console.error("Error: Token not found.");
        return;
    }

    const testCode = `
function onIdle(me, enemy, game) {
    if (game.frames === 1) {
        me.turn("down");
    } else if (game.frames === 2) {
        me.go();
    }
}
`;

    console.log("Sending simulation request...");
    try {
        const res = await fetch('https://agentank.ai/api/agent/tank/simulate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                opponentId: 'nova-scout',
                mapId: 'classic',
                code: testCode
            })
        });

        if (!res.ok) {
            console.error(`HTTP Error: ${res.status} ${await res.text()}`);
            return;
        }

        const data = await res.json();
        const records = data.replayData.replay.records || [];
        
        console.log("Starting state of players:");
        console.log(JSON.stringify(data.replayData.replay.meta.players, null, 2));

        console.log("Events in first 20 frames:");
        for (let i = 0; i < Math.min(20, records.length); i++) {
            console.log(`Frame ${i}:`, JSON.stringify(records[i], null, 2));
        }
    } catch (e) {
        console.error("Error calling simulate API:", e);
    }
}

testAbsoluteTurn();
