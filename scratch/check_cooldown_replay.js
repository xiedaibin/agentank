const fs = require('fs');
const matchData = JSON.parse(fs.readFileSync('targeted_evolution_replays/loss_3773_mat_LHnQ1oMxibA5ainqR.json', 'utf8'));
const replay = matchData.replayData?.replay || matchData.replay;
const records = replay.records || [];

const defender = matchData.participants.defender;
const isChallengerMe = matchData.participants.challenger.tankId === 230;
const enemyIndex = isChallengerMe ? 1 : 0;

// Replay players config
console.log("Enemy index in players array:", enemyIndex);
const playersMeta = replay.meta.players;
console.log("Enemy name:", playersMeta[enemyIndex].name);

// Loop through the first 10 frames and check enemy status
for (let fIdx = 0; fIdx < 10; fIdx++) {
    // Find enemy state in the game state of this frame
    // In raw replay, each frame record contains action events, but how is the full state stored?
    // Let's inspect the keys of raw replay records
    console.log(`\nFrame ${fIdx} raw records:`);
    records[fIdx].forEach(ev => {
        if (ev.objectId === playersMeta[enemyIndex].tank.id || ev.sourceObjectId === playersMeta[enemyIndex].tank.id || ev.tank?.id === playersMeta[enemyIndex].tank.id) {
            console.log("  Event:", JSON.stringify(ev));
        }
    });
}
