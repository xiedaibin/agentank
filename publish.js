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
            notes: "XDB V12.96 - 移除了草丛内盲目跑出草地的强控，转而在近距离（<=3）且技能就绪时，直接越过草丛脱敏，将超载枪线纳入幽灵避弹和安全规避判定",
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