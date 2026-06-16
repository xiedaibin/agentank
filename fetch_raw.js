const fs = require('fs');

async function main() {
    const matchId = process.argv[2];
    if (!matchId) {
        console.error("Please provide matchId");
        process.exit(1);
    }
    const url = `http://agentank.ai/api/matches/${matchId}/agent.json?view=raw`;
    console.log("Fetching raw replay from:", url);
    const res = await fetch(url);
    if (!res.ok) {
        console.error("Failed to fetch", res.status);
        process.exit(1);
    }
    const data = await res.json();
    fs.writeFileSync(`raw_${matchId}.json`, JSON.stringify(data, null, 2));
    console.log(`Saved raw_${matchId}.json`);
}

main().catch(console.error);
