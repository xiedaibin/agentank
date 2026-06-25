const fs = require('fs');
const path = require('path');

async function download() {
    const matchId = process.argv[2] || 'mat_4J9TqrLo22B7tuchO';
    const mainUrl = `https://agentank.ai/api/matches/${matchId}/agent.json`;
    try {
        console.log("Fetching URL:", mainUrl);
        const res = await fetch(mainUrl);
        if (!res.ok) throw new Error("HTTP error: " + res.status);
        const data = await res.json();
        
        if (!fs.existsSync('replays')) {
            fs.mkdirSync('replays', { recursive: true });
        }
        fs.writeFileSync(`replays/${matchId}.json`, JSON.stringify(data, null, 2));
        console.log(`Saved replays/${matchId}.json`);

        if (data.eventsUrl) {
            console.log("Fetching eventsUrl:", data.eventsUrl);
            const rEvents = await fetch(data.eventsUrl);
            const eventsData = await rEvents.json();
            fs.writeFileSync(`replays/${matchId}_events.json`, JSON.stringify(eventsData, null, 2));
            console.log(`Saved replays/${matchId}_events.json`);
        }

        if (data.rawReplayUrl) {
            console.log("Fetching rawReplayUrl:", data.rawReplayUrl);
            const rRaw = await fetch(data.rawReplayUrl);
            const rawData = await rRaw.json();
            fs.writeFileSync(`replays/${matchId}_raw.json`, JSON.stringify(rawData, null, 2));
            console.log(`Saved replays/${matchId}_raw.json`);
        }
        
    } catch (e) {
        console.error("Error:", e);
    }
}

download();
