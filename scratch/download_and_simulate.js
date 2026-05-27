const fs = require('fs');

async function main() {
    const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
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
