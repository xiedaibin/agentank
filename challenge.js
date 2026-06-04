const { getToken } = require('./config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    
    for (let i = 1; i <= 3; i++) {
        console.log(`\nStarting match ${i}...`);
        try {
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
            } else {
                const matchData = await challengeRes.ok ? await challengeRes.json() : null;
                if (matchData) {
                    console.log("Full API Response:", JSON.stringify(matchData, null, 2));
                    const urlId = matchData.urlId || matchData.matchUrlId || matchData.id;
                    console.log("Match URL: https://agentank.ai/history/" + urlId);
                    console.log("Winner:", matchData.winner || matchData.winnerTankName);
                    console.log("Reason:", matchData.reason || matchData.resultReason);
                }
            }
        } catch (e) {
            console.error("Error:", e.message);
        }
        
        if (i < 3) {
            console.log("Waiting 3 seconds for simulation cooldown...");
            await new Promise(r => setTimeout(r, 3000));
        }
    }
}

main();