const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
const matchId = 'mat_6kLuYxxXbWv3yvOkN';

async function main() {
    const res = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=events`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    const events = data.events || [];
    console.log("All Events:");
    console.log(JSON.stringify(events, null, 2));
}

main();
