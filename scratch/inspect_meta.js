const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    const matchId = 'mat_3hAMVjAFdQj8ItYPn';
    const url = `https://agentank.ai/api/matches/${matchId}/agent.json?view=raw`;

    console.log("Fetching raw replay...");
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
        console.error(`HTTP error: ${res.status}`);
        return;
    }
    const data = await res.json();
    console.log("Replay keys:", Object.keys(data));
    if (data.replayData) {
        console.log("replayData keys:", Object.keys(data.replayData));
        const meta = data.replayData.replay.meta;
        console.log("Meta players structure:");
        console.log(JSON.stringify(meta.players, null, 2));
    }
}

main().catch(console.error);
