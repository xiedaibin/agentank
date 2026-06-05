const fs = require('fs');
const { getToken } = require('../config');

const dummyCode = `function onIdle(me, enemy, game) {
    me.turn("left"); // Spin to consume 1 action per frame and prevent runTime timeout
}`;

async function simulateMap(mapId) {
    const token = getToken();
    const url = 'https://agentank.ai/api/agent/tank/simulate';
    
    try {
        console.log(`Simulating on map: ${mapId}...`);
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
        const resultReason = data.resultReason || (data.replayData && data.replayData.replay && data.replayData.replay.meta && data.replayData.replay.meta.result ? data.replayData.replay.meta.result.reason : 'N/A');
        
        console.log(`  Map ID: ${mapId}`);
        console.log(`  Total Frames: ${records.length}`);
        console.log(`  End Reason: ${resultReason}`);
        return { mapId, frames: records.length, reason: resultReason };
    } catch (e) {
        console.error(`  Error simulating ${mapId}:`, e);
        return null;
    }
}

async function main() {
    const maps = [
        'classic', 
        'arena', 
        'public-map-55', 
        'public-map-53', 
        'public-map-16', 
        'public-map-15', 
        'public-map-6', 
        'public-map-1'
    ];
    
    const results = [];
    for (const mapId of maps) {
        const res = await simulateMap(mapId);
        if (res) results.push(res);
        // Wait 2.5 seconds to respect the API rate limit (once per 2 seconds)
        await new Promise(resolve => setTimeout(resolve, 2500));
    }
    
    console.log("\n=== Final Results ===");
    results.forEach(r => {
        console.log(`${r.mapId}: ${r.frames} frames (${r.reason})`);
    });
}

main();
