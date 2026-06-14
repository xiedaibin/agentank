const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('mat_3ZIQPKyTpo9LmGgaQ.json', 'utf8'));
const records = raw.replayData.replay.records || [];
const players = raw.replayData.replay.meta.players;
console.log("Players:", players);

for (let f = 0; f < records.length; f++) {
    const evs = records[f] || [];
    for (const ev of evs) {
        if (ev.objectId === 230 || ev.sourceObjectId === 230 || ev.targetObjectId === 230 || ev.by === 0) {
            console.log(`Frame ${f}:`, JSON.stringify(ev));
        }
    }
}
