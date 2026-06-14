const fs = require('fs');
const { getToken } = require('./config');

async function fetchReplay() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    const matchId = process.argv[2] || 'mat_2sc7y6a2Mp6JM0FCv';
    const url = `https://agentank.ai/api/matches/${matchId}/agent.json?view=events`;

    try {
        console.log(`Fetching events for ${matchId}...`);
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const dir = 'replays';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(`${dir}/${matchId}_events.json`, JSON.stringify(data, null, 2));
        console.log(`Saved ${dir}/${matchId}_events.json`);
    } catch (e) {
        console.error(e);
    }
}

fetchReplay();
