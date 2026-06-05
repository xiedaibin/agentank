const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    try {
        console.log("Fetching last 100 matches...");
        const res = await fetch('https://agentank.ai/api/agent/tank/matches?limit=100', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const matches = data.matches || [];
        
        console.log(`Fetched ${matches.length} matches. Fetching details...`);
        const mapFrames = {};
        
        for (let i = 0; i < matches.length; i++) {
            const m = matches[i];
            const matchId = m.urlId || m.id;
            
            const detailRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!detailRes.ok) continue;
            const detail = await detailRes.json();
            const summary = detail.summary || {};
            const matchInfo = detail.match || {};
            const mapId = matchInfo.mapId;
            const mapName = matchInfo.mapName;
            const reason = matchInfo.resultReason;
            const frames = summary.framesTotal;
            
            if (!mapFrames[mapId]) {
                mapFrames[mapId] = {
                    name: mapName,
                    maxSeen: 0,
                    starFrames: [],
                    reasons: {}
                };
            }
            
            mapFrames[mapId].reasons[reason] = (mapFrames[mapId].reasons[reason] || 0) + 1;
            if (frames > mapFrames[mapId].maxSeen) {
                mapFrames[mapId].maxSeen = frames;
            }
            if (reason === 'star' || reason === 'runTime') {
                mapFrames[mapId].starFrames.push(frames);
            }
        }
        
        console.log("\n=== Map Frame Statistics ===");
        console.log(JSON.stringify(mapFrames, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
