const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    const urlId = 'mat_FJn5Ldq6hKq9aHGqx';
    const url = `https://agentank.ai/api/matches/${urlId}/agent.json?view=raw`;
    
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const rawData = await res.json();
    console.log("rawData keys:", Object.keys(rawData));
    if (rawData.replayData) {
        console.log("replayData keys:", Object.keys(rawData.replayData));
        if (rawData.replayData.replay) {
            console.log("replay keys:", Object.keys(rawData.replayData.replay));
        }
    }
}

main();
