const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';

async function main() {
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
    
    const data = await challengeRes.json();
    console.log("Keys:", Object.keys(data));
    console.log("Match object keys (if exists):", data.match ? Object.keys(data.match) : 'no match object');
    console.log("Result keys:", data.result ? Object.keys(data.result) : 'no result object');
}

main();
