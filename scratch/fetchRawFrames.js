const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
const matchId = 'mat_6kLuYxxXbWv3yvOkN';

async function main() {
    const res = await fetch(`https://agentank.ai/api/matches/${matchId}/agent/frames?from=1&to=20`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    const frames = data.frames || [];
    
    frames.forEach(f => {
        if (f.events) {
            f.events.forEach(e => {
                if (e.type === 'speech' && e.text) {
                    console.log(`Frame ${f.frame}: Tank spoke "${e.text}" at position ${JSON.stringify(e.position)}`);
                }
            });
        }
    });
}

main();
