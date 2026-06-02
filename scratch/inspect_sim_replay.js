const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    const code = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');
    
    console.log("Running simulation...");
    const res = await fetch('https://agentank.ai/api/agent/tank/simulate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            opponentId: 'azure-hunter',
            mapId: 'classic'
        })
    });
    
    if (!res.ok) {
        console.error("Error:", await res.text());
        return;
    }
    
    const data = await res.json();
    const replay = data.replayData || data;
    if (replay.replay && replay.replay.records) {
        const records = replay.replay.records;
        const types = new Set();
        const actions = new Set();
        for (let f = 0; f < records.length; f++) {
            const frameEvents = records[f] || [];
            for (const ev of frameEvents) {
                if (ev.type) types.add(ev.type);
                if (ev.action) actions.add(ev.action);
            }
        }
        console.log("Event types:", Array.from(types));
        console.log("Action types:", Array.from(actions));
    }
}

main();
