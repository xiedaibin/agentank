const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
const matchId = 'mat_GGGmOjJPozRBh9nv2';

async function main() {
    const res = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=events`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    const events = data.events || [];
    console.log("Events from old match (without interceptor):");
    events.forEach(e => {
        if (e.frame >= 30) {
            console.log(JSON.stringify(e));
        }
    });
}

main();
