const { getToken } = require('../config');

async function main() {
    const token = getToken();
    const matchId = 'mat_3hAMVjAFdQj8ItYPn';
    const url = `https://agentank.ai/api/matches/${matchId}/agent.json?view=events`;

    console.log("Fetching events...");
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
        console.error(`HTTP error: ${res.status}`);
        return;
    }
    const data = await res.json();
    const events = data.events || data.records || [];
    console.log(`Total events: ${events.length}`);
    
    // Print first 5 events
    console.log("First 5 events:");
    console.log(JSON.stringify(events.slice(0, 5), null, 2));

    // Print all speak events
    const speaks = events.filter(ev => ev.event === 'speak' || ev.type === 'speak' || JSON.stringify(ev).includes('speak'));
    console.log(`Found ${speaks.length} speak-related events:`);
    console.log(JSON.stringify(speaks, null, 2));
}

main().catch(console.error);
