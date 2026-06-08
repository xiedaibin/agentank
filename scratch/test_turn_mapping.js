const fs = require('fs');
const { getToken } = require('../config');

async function testTurnMapping() {
    const token = getToken();
    const testCode = `
function onIdle(me, enemy, game) {
    const f = game.frames;
    me.speak("F" + f + ":" + me.tank.direction);
    
    if (f === 1) {
        // Face UP, turn UP
        me.turn("up");
    } else if (f === 2) {
        // Face UP, turn DOWN
        me.turn("down");
    } else if (f === 3) {
        // Face DOWN, turn UP
        me.turn("up");
    } else if (f === 4) {
        // Face UP, turn DOWN
        me.turn("down");
    } else if (f === 5) {
        // Face DOWN, turn DOWN
        me.turn("down");
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
        console.log("Response:", data);
        const records = data.replayData ? (data.replayData.replay.records || []) : [];
        
        console.log("Replay records:");
        for (let i = 0; i < Math.min(10, records.length); i++) {
            console.log(`Frame ${i}:`, JSON.stringify(records[i], null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

testTurnMapping();
