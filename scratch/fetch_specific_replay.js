const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    const matchId = 'mat_0tnLfXhzpKOD6AGBZ';
    console.log(`Downloading raw match data for ${matchId}...`);
    
    const resRaw = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=raw`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!resRaw.ok) {
        console.error("Failed to download raw match data:", resRaw.status);
        return;
    }

    const raw = await resRaw.json();
    fs.writeFileSync(path.join(__dirname, `${matchId}_raw.json`), JSON.stringify(raw, null, 2));
    console.log("Done saving raw match details.");
}

main();
