const fs = require('fs');
const { getToken } = require('./config');

async function main() {
    const code = fs.readFileSync('new_tank.js', 'utf8');
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    
    console.log("Publishing code...");
    const res = await fetch('https://agentank.ai/api/agent/tank/code', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            notes: "XDB V12.97 - 引入 canShoot, isLoS 以及 isOnEnemyGunLine 的帧内缓存优化，降低运行开销以规避平局 runtime 判定劣势",
            submittedBy: "Gemini"
        })

    });
    
    if (!res.ok) {
        console.error("Publish failed:", await res.text());
        return;
    }
    console.log("Publish success:", await res.json());
    
    console.log("Waiting 2 seconds for simulation cooldown just in case...");
    await new Promise(r => setTimeout(r, 2000));
    
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
    
    if (!challengeRes.ok) {
        console.error("Challenge failed:", await challengeRes.text());
        return;
    }
    const matchData = await challengeRes.json();
    console.log("Challenge success!");
    console.log("Match URL: https://agentank.ai/history/" + matchData.matchUrlId);
    console.log("Winner:", matchData.winner);
    console.log("Reason:", matchData.reason);
}

main();