const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';

async function main() {
    console.log("Challenging random opponent...");
    const challengeRes = await fetch('https://agentank.ai/api/agent/tank/challenge', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            randomOpponent: true,
            mapId: 'classic'
        })
    });
    
    console.log("Status:", challengeRes.status);
    const text = await challengeRes.text();
    console.log("Raw Response:", text);
}

main();
