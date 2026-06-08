const fs = require('fs');
const { getToken } = require('../config');

async function inspectSimulationReplay() {
    const token = getToken();
    const testCode = `
function onIdle(me, enemy, game) {
    print("onIdle called at frame", game.frames);
    if (game.frames === 1) {
        me.turn("down");
        print("me.turn('down') called");
    } else if (game.frames === 2) {
        me.go();
        print("me.go() called");
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
        console.log("Keys of replay:", Object.keys(data.replayData.replay));
        // Check for any potential log properties in replay
        for (const key of Object.keys(data.replayData.replay)) {
            if (key.toLowerCase().includes('log') || key.toLowerCase().includes('error') || key.toLowerCase().includes('stdout') || key.toLowerCase().includes('print')) {
                console.log(`Key ${key} content:`, JSON.stringify(data.replayData.replay[key], null, 2));
            }
        }
        
        // Also look at meta
        if (data.replayData.replay.meta) {
            console.log("Keys of meta:", Object.keys(data.replayData.replay.meta));
        }
    } catch (e) {
        console.error(e);
    }
}

inspectSimulationReplay();
