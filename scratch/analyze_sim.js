const fs = require('fs');
const path = require('path');
const sim = JSON.parse(fs.readFileSync(path.join(__dirname, 'sim_res.json'), 'utf8'));
const records = sim.replayData.replay.records || [];
console.log("Total frames in simulation:", records.length);

// Let's identify the player names and indices
console.log("Names in simulation:", sim.replayData.names);
// Usually index 0 is our tank (challenger) and index 1 is opponent

for (let f = 8; f <= 25; f++) {
    console.log(`\n--- Frame ${f} ---`);
    console.log(JSON.stringify(records[f], null, 2));
}
