const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: Token not found.");
        return;
    }

    const matchId = 'mat_JE6HpiKYL071kNivD';
    const url = `https://agentank.ai/api/matches/${matchId}/agent.json?view=events`;

    console.log(`Fetching events for ${matchId}...`);
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            console.error(`Fetch failed: Status ${res.status}`);
            return;
        }
        const data = await res.json();
        console.log("\n=== MATCH SUMMARY ===");
        console.log("Winner:", data.summary.winnerTankName);
        console.log("Reason:", data.summary.resultReason);
        console.log("Total Frames:", data.summary.totalFrames);
        
        console.log("\n=== PARTICIPANTS ===");
        data.participants.forEach(p => {
            console.log(`Tank ID: ${p.tankId}, Name: ${p.name}, Branch: ${p.branch || 'main'}, Skill: ${p.skillType}`);
        });

        console.log("\n=== TELEPORT EVENTS ===");
        if (data.replayData && data.replayData.replay) {
            const frames = data.replayData.replay;
            frames.forEach((f, idx) => {
                if (f.events) {
                    f.events.forEach(e => {
                        if (e.type === 'teleport' || e.name === 'teleport') {
                            console.log(`Frame ${idx}: Player ${e.playerIndex || e.index} teleported to [${e.position || e.target}]`);
                        }
                        if (e.type === 'spawnStar' || e.name === 'spawnStar' || e.type === 'starSpawned') {
                            console.log(`Frame ${idx}: Star spawned at [${e.position}]`);
                        }
                        if (e.type === 'collectStar' || e.name === 'collectStar' || e.type === 'starCollected') {
                            console.log(`Frame ${idx}: Player ${e.playerIndex || e.index} collected star at [${e.position}]`);
                        }
                    });
                }
            });
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
