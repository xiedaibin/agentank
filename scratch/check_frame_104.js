const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('scratch/mat_3MNY42zxwsZEQaVft_raw.json', 'utf8'));
const records = raw.replayData.replay.records || [];
for (let f = 102; f <= 106; f++) {
    console.log(`=== Frame ${f} ===`);
    console.log(JSON.stringify(records[f], null, 2));
}
