const { getToken } = require('../config');

async function main() {
    const token = getToken();
    const urlId = "mat_5L3RJjwJAGyCi1z2b";
    const res = await fetch(`https://agentank.ai/api/matches/${urlId}/agent.json?view=events`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const events = data.events || [];
    console.log("Total events:", events.length);
    console.log("First 30 events:", JSON.stringify(events.slice(0, 30), null, 2));
}

main();
