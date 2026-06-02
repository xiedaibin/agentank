const fs = require('fs');
const path = require('path');

const matchId = 'mat_Im0S2mzsHMuGp1M4r';
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, `${matchId}_raw.json`), 'utf8'));
const records = raw.replayData.replay.records || [];

for (let f = 22; f <= 24; f++) {
    console.log(`\n--- Frame ${f} ---`);
    console.log(JSON.stringify(records[f], null, 2));
}
