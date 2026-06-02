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
            opponentId: 'nova-scout',
            mapId: 'classic'
        })
    });
    
    console.log("Status:", res.status);
    if (!res.ok) {
        console.error("Error:", await res.text());
    } else {
        const data = await res.json();
        console.log("Winner:", data.winner);
        console.log("Reason:", data.resultReason);
        console.log("Used Candidate Code:", data.usedCandidateCode);
    }
}

main();
