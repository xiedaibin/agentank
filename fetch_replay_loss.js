const fs = require('fs');
const { getToken } = require('./config');

async function fetchReplay(matchId) {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    const url = `https://agentank.ai/api/matches/${matchId}/agent.json`;

    try {
        console.log(`Fetching ${matchId}...`);
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
        const data = await res.json();
        fs.writeFileSync(`${matchId}.json`, JSON.stringify(data, null, 2));
        console.log(`Saved ${matchId}.json`);
    } catch (e) {
        console.error(e);
    }
}

const mid = process.argv[2] || 'mat_6Z9cuj6BFzQBOQHOj';
fetchReplay(mid);
