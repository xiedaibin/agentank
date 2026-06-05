const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    try {
        const res = await fetch('https://agentank.ai/api/agent/tank/matches?limit=100', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const matches = data.matches || [];
        
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
            const reason = matchInfo.resultReason;
            const frames = summary.framesTotal;
            
            if (reason === 'star' && frames < 125) {
                console.log(`Match: ${matchId}`);
                console.log(`  Map: ${matchInfo.mapId} (${matchInfo.mapName})`);
                console.log(`  Frames: ${frames}`);
                console.log(`  Winner: ${summary.result ? summary.result.winner : 'N/A'}`);
                console.log(`  Tanks:`, JSON.stringify(summary.tanks, null, 2));
                console.log(`-----------------------------------`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

main();
