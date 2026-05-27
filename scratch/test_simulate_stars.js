const fs = require('fs');

async function main() {
    const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
    
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
