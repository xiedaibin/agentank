const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

async function download(urlId) {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found.");
        process.exit(1);
    }

    const rawUrl = `https://agentank.ai/api/matches/${urlId}/agent.json?view=raw`;
    const summaryUrl = `https://agentank.ai/api/matches/${urlId}/agent.json`;

    console.log(`Downloading raw for ${urlId}...`);
    const rawRes = await fetch(rawUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (rawRes.ok) {
        const rawJson = await rawRes.json();
        fs.writeFileSync(path.join(__dirname, `${urlId}_raw.json`), JSON.stringify(rawJson, null, 2));
        console.log(`Saved ${urlId}_raw.json`);
    } else {
        console.error(`Failed to fetch raw:`, rawRes.status);
    }

    console.log(`Downloading summary for ${urlId}...`);
    const sumRes = await fetch(summaryUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (sumRes.ok) {
        const sumJson = await sumRes.json();
        fs.writeFileSync(path.join(__dirname, `${urlId}_summary.json`), JSON.stringify(sumJson, null, 2));
        console.log(`Saved ${urlId}_summary.json`);
    } else {
        console.error(`Failed to fetch summary:`, sumRes.status);
    }
}

download("mat_CempGXxxBdoKbGuhC");
