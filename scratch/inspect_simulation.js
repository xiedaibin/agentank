const fs = require('fs');
const { getToken } = require('../config');

async function inspectSimulation() {
    const token = getToken();
    const testCode = `
function onIdle(me, enemy, game) {
    try {
        if (game.frames === 1) {
            me.turn("down");
        } else if (game.frames === 2) {
            me.go();
        }
    } catch(e) {
        print("ERROR:", e.message);
    }
}
`;
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

        const data = await res.json();
        console.log("Keys of response:", Object.keys(data));
        console.log("Keys of replayData:", Object.keys(data.replayData));
        if (data.replayData.replay.logs) {
            console.log("Replay logs:", JSON.stringify(data.replayData.replay.logs, null, 2));
        }
        if (data.replayData.replay.errors) {
            console.log("Replay errors:", JSON.stringify(data.replayData.replay.errors, null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

inspectSimulation();
