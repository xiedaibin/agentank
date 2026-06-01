const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    const urlId = 'mat_0fdvTco5BEr4mUFQc';
    const url = `https://agentank.ai/api/matches/${urlId}/agent.json?view=raw`;
    
    console.log("Fetching raw replay from " + url);
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
        const json = await res.json();
        console.log("Keys in JSON:", Object.keys(json));
        if (json.replayData) {
            console.log("Keys in json.replayData:", Object.keys(json.replayData));
            if (json.replayData.replay) {
                console.log("Keys in json.replayData.replay:", Object.keys(json.replayData.replay));
                if (json.replayData.replay.records) {
                    console.log("Records length:", json.replayData.replay.records.length);
                }
            }
        } else if (json.replay) {
            console.log("Keys in json.replay:", Object.keys(json.replay));
        }
        fs.writeFileSync('scratch/sample_raw.json', JSON.stringify(json, null, 2));
        console.log("Saved to scratch/sample_raw.json");
    } else {
        console.error("Failed to fetch:", res.status, await res.text());
    }
}

main();
