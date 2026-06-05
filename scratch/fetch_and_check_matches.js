const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    const url = 'https://agentank.ai/api/agent/tank/matches?limit=50';
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
        const data = await res.json();
        
        console.log(`Fetched ${data.matches ? data.matches.length : 0} matches.`);
        const matches = data.matches || [];
        
        // Print matches of interest
        matches.forEach(m => {
            const summary = m.summary || {};
            const result = summary.result || {};
            console.log(`Match: ${m.urlId || m.id}`);
            console.log(`  Map: ${m.mapId} (${m.mapName})`);
            console.log(`  Reason: ${m.resultReason || result.reason}`);
            console.log(`  Frames: ${summary.framesTotal}`);
            console.log(`  Stars: challenger=${summary.tanks && summary.tanks.XDB ? summary.tanks.XDB.stars : 'N/A'}, defender=${m.defenderTankName || 'Opponent'}: ${summary.tanks && m.defenderTankName && summary.tanks[m.defenderTankName] ? summary.tanks[m.defenderTankName].stars : 'N/A'}`);
            console.log(`-----------------------------------`);
        });

    } catch (e) {
        console.error("Error fetching matches:", e);
    }
}

main();
