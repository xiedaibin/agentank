const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';

async function main() {
    const res = await fetch('https://agentank.ai/api/agent/tank/matches?limit=4', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    const matches = data.matches || [];
    console.log("Recent Matches:");
    matches.forEach((m, i) => {
        console.log(`[${i + 1}] ID: ${m.urlId || m.id}`);
        console.log(`    Challenger: ${m.challengerTankName} (ID: ${m.challengerTankId})`);
        console.log(`    Defender: ${m.defenderTankName} (ID: ${m.defenderTankId})`);
        console.log(`    Winner: ${m.winnerTankName}`);
        console.log(`    Created: ${m.createdAt}`);
        console.log(`    URL: https://agentank.ai/history/${m.urlId || m.id}`);
        console.log("-----------------------------------------");
    });
}

main();
