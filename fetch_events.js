const fs = require('fs');
const { getToken } = require('./config');

async function fetchEvents(matchId) {
    const token = getToken();
    const url = `https://agentank.ai/api/matches/${matchId}/agent.json?view=events`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(await res.text());
    const dir = 'replays';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/${matchId}_events.json`, JSON.stringify(data, null, 2));
    console.log(`Saved ${dir}/${matchId}_events.json`);
}

fetchEvents(process.argv[2]);
