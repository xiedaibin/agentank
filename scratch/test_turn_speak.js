const fs = require('fs');
const { getToken } = require('../config');

async function testTurnAndSpeak() {
    const token = getToken();
    const testCode = `
function onIdle(me, enemy, game) {
    if (game.frames === 1) {
        me.turn("left");
        me.speak("F1");
    } else if (game.frames === 2) {
        me.go();
        me.speak("F2");
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
        const records = data.replayData.replay.records || [];
        
        console.log("Starting state:");
        console.log(JSON.stringify(data.replayData.replay.meta.players, null, 2));

        console.log("Map tile at [2][3] (down):", data.replayData.map.map[2] ? data.replayData.map.map[2][3] : "undefined");
        console.log("Map tile at [2][1] (up):", data.replayData.map.map[2] ? data.replayData.map.map[2][1] : "undefined");
        console.log("Map tile at [1][2] (left):", data.replayData.map.map[1] ? data.replayData.map.map[1][2] : "undefined");
        console.log("Map tile at [3][2] (right):", data.replayData.map.map[3] ? data.replayData.map.map[3][2] : "undefined");

        console.log("Events in first 10 frames:");
        for (let i = 0; i < Math.min(10, records.length); i++) {
            console.log(`Frame ${i}:`, JSON.stringify(records[i], null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

testTurnAndSpeak();
