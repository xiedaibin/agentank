const fs = require('fs');
const { getToken } = require('../config');

const dummyCode = `function onIdle(me, enemy, game) {
    // Stand still to let match run to timeout
}`;

async function simulateMap(mapId) {
    const token = getToken();
    const url = 'https://agentank.ai/api/agent/tank/simulate';
    
    try {
        console.log(`Running simulation on map: ${mapId}...`);
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                opponentId: 'nova-scout',
                mapId: mapId,
                code: dummyCode
            })
        });
        
        if (!res.ok) {
            console.error(`  Failed (HTTP ${res.status}): ${await res.text()}`);
            return null;
        }
        
        const data = await res.json();
        const records = data.replayData && data.replayData.replay && data.replayData.replay.records ? data.replayData.replay.records : [];
        console.log(`  Map ID: ${mapId}`);
        console.log(`  Total Records/Frames: ${records.length}`);
        if (data.replayData && data.replayData.replay && data.replayData.replay.meta) {
            console.log(`  Meta Result:`, JSON.stringify(data.replayData.replay.meta.result));
        }
        return records.length;
    } catch (e) {
        console.error(`  Error simulating ${mapId}:`, e);
        return null;
    }
}

async function main() {
    const maps = ['classic', 'arena', 'public-map-15', 'public-map-16'];
    for (const mapId of maps) {
        await simulateMap(mapId);
        // Wait 2.5 seconds to respect the API rate limit (once per 2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2500));
    }
}

main();
