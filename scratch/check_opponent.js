const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Token not found.");
        return;
    }
    const res = await fetch('https://agentank.ai/api/agent/tank/matches?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
        console.error("Failed to fetch matches", res.status);
        return;
    }
    const data = await res.json();
    const list = data.matches || data;
    if (Array.isArray(list)) {
        const matches = list.filter(m => 
            m.challengerTankUrlId === "tnk_8TDpuJKhsZpIcH1OX" || 
            m.defenderTankUrlId === "tnk_8TDpuJKhsZpIcH1OX"
        );
        console.log(`Found ${matches.length} matches with tnk_8TDpuJKhsZpIcH1OX:`);
        for (const m of matches) {
            const isWinner = m.winnerTankId === 230;
            console.log(`Match ID: ${m.id}, URL ID: ${m.urlId}, Winner: ${isWinner ? 'Me' : 'Opponent'}, Created: ${m.createdAt}`);
        }
    } else {
        console.log("No match array found.");
    }
}

main().catch(console.error);
