const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    
    // We send a minimal code that accesses enemy.stars safely
    const testCode = `
function onIdle(me, enemy, game) {
    if (enemy && typeof enemy.stars !== 'undefined') {
        // Accessing enemy.stars
        var s = enemy.stars;
    }
    me.go();
}
`;

    console.log("Sending simulation request...");
    const res = await fetch('https://agentank.ai/api/agent/tank/simulate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            opponentId: 'nova-scout',
            mapId: 'classic',
            code: testCode
        })
    });
    
    if (!res.ok) {
        console.error("Simulation failed:", res.status, await res.text());
        return;
    }
    
    const data = await res.json();
    console.log("Simulation resultReason:", data.resultReason);
    console.log("Winner:", data.winner);
}

main();
