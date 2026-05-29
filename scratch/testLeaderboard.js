const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';

async function main() {
    const res = await fetch('https://agentank.ai/api/agent/leaderboard?period=all&sort=score&limit=5', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

main();
