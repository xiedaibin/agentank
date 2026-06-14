const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('mat_LFzHxaL41Y70hglLn.json', 'utf8'));
const records = raw.replayData.replay.records || [];
const players = raw.replayData.replay.meta.players;

for (let f = 0; f < records.length; f++) {
    const evs = records[f] || [];
    for (const ev of evs) {
        if (ev.objectId === '03ce3ef3' || ev.sourceObjectId === '03ce3ef3' || ev.targetObjectId === '03ce3ef3' || ev.by === 1) {
            if (ev.action === "cast" || ev.type === "skill" || ev.event === "skill_cast") {
                console.log(`Frame ${f}:`, JSON.stringify(ev));
            }
        }
    }
}
