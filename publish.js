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
            notes: "XDB V12.95 - 针对超载坦克微调偏置威胁过滤条件，当距离<=5且处于右下区时，放弃预瞄、通道伏击开火并强制在草丛内起跑逃生",
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