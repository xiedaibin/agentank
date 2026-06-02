const fs = require('fs');
const path = require('path');

const matchId = 'mat_0tnLfXhzpKOD6AGBZ';
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, `${matchId}_raw.json`), 'utf8'));
const records = raw.replayData.replay.records || [];

// Look at the frames to see where Taoqi is and when it is visible
// In the raw replay, records show actions. But there's also the frames array which shows the state of the game!
// Let's print the frames data to see what is visible.
if (raw.replayData.replay.frames) {
    console.log("Found raw frames array!");
    raw.replayData.replay.frames.forEach((f, idx) => {
        // Find players
        const player0 = f.players[0]; // Taoqi
        const player1 = f.players[1]; // XDB
        console.log(`Frame ${idx}:`);
        console.log(`  Player 0 (Taoqi) Pos: ${JSON.stringify(player0.tank.position)} Dir: ${player0.tank.direction} status: ${JSON.stringify(player0.status)}`);
        console.log(`  Player 1 (XDB)   Pos: ${JSON.stringify(player1.tank.position)} Dir: ${player1.tank.direction} status: ${JSON.stringify(player1.status)}`);
    });
} else {
    console.log("No raw frames array. Let's inspect raw object keys.");
    console.log(Object.keys(raw.replayData.replay));
}
