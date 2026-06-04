const fs = require('fs');
const { getToken } = require('../config');

async function fetchFrames() {
    const token = getToken();
    const matchId = 'mat_DBhrywgah5C42cT3L';
    // Fetch all frames 0-22
    const url = `https://agentank.ai/api/matches/${matchId}/agent/frames?from=0&to=22`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
        const data = await res.json();
        fs.writeFileSync(`${matchId}_frames_all.json`, JSON.stringify(data, null, 2));
        console.log(`Saved frames data`);
    } catch (e) {
        console.error(e);
    }
}

fetchFrames();
