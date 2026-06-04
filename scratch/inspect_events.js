const fs = require('fs');

const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';

async function main() {
    const urlId = 'mat_Ex5GrRhOXL1HxZfVW';
    try {
        const res = await fetch(`https://agentank.ai/api/matches/${urlId}/agent.json?view=events`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const eventsData = await res.json();
        console.log("Keys in response:", Object.keys(eventsData));
        const events = eventsData.events || eventsData.records || [];
        console.log("Total events:", events.length);
        console.log("Sample event:", JSON.stringify(events.slice(0, 10), null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main();
