const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
const matchId = 'mat_6kLuYxxXbWv3yvOkN';

async function main() {
    const res = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=events`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    console.log("Keys:", Object.keys(data));
    if (data.replay) console.log("Replay keys:", Object.keys(data.replay));
    if (data.replayData) console.log("ReplayData keys:", Object.keys(data.replayData));
}

main();
