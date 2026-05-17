const fs = require('fs');

async function fetchReplay() {
    const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
    const matchId = 'mat_CYPSPzdrpj1HDgnu2';
    const url = `https://agentank.ai/api/matches/${matchId}/agent.json`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`Status ${res.status}: ${await res.text()}`);
        const data = await res.json();
        fs.writeFileSync(`${matchId}.json`, JSON.stringify(data, null, 2));
        console.log(`Saved ${matchId}.json`);
    } catch (e) {
        console.error(e);
    }
}

fetchReplay();
