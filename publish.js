const fs = require('fs');
const { getToken } = require('./config');

const { execSync } = require('child_process');

async function main() {
    const code = fs.readFileSync('new_tank.js', 'utf8');
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    let branch = process.argv[2];
    if (!branch) {
        try {
            branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
            console.log(`Detected git branch: ${branch}`);
        } catch (e) {
            console.warn("Could not detect git branch, falling back to 'main'");
            branch = 'main';
        }
    } else {
        console.log(`Using branch specified in argument: ${branch}`);
    }

    console.log(`Publishing code to AgenTank branch '${branch}'...`);
    const res = await fetch('https://agentank.ai/api/agent/tank/code', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            notes: `XDB Strategic Assassin V13.0 - Multiplayer & Team Optimized (${branch})`,
            submittedBy: "Gemini",
            branch: branch
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
    const urlId = matchData.urlId || matchData.matchUrlId;
    const winner = matchData.winnerTankName || matchData.winner;
    const reason = matchData.resultReason || matchData.reason;
    console.log("Match URL: https://agentank.ai/history/" + urlId);
    console.log("Winner:", winner);
    console.log("Reason:", reason);
}

main();