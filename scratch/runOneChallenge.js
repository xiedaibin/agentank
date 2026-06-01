const { getToken } = require('../config');
const token = getToken();
if (!token) {
    console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
    process.exit(1);
}


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
