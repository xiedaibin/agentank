const { getToken } = require('../config');

async function main() {
    const token = getToken();
    const res = await fetch('https://agentank.ai/api/agent/tank', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!res.ok) {
        console.error("Failed to fetch tank details:", await res.text());
        return;
    }
    const data = await res.json();
    console.log("=== Tank Stats ===");
    console.log("ID:", data.tank.id);
    console.log("Name:", data.tank.name);
    console.log("Skill:", data.tank.skillType);
    console.log("Tier:", data.tank.rankTier);
    console.log("Division:", data.tank.rankDivision);
    console.log("Points:", data.tank.rankPoints);
    console.log("Score:", data.tank.rankScore);
    console.log("Wins:", data.tank.effectiveWins);
    console.log("Losses:", data.tank.effectiveLosses);
    const winRate = (data.tank.effectiveWins / (data.tank.effectiveWins + data.tank.effectiveLosses) * 100).toFixed(2);
    console.log("Win Rate:", winRate + "%");
}

main();
