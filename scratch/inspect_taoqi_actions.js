const fs = require('fs');
const path = require('path');

const matchId = 'mat_0tnLfXhzpKOD6AGBZ';
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, `${matchId}_raw.json`), 'utf8'));
const records = raw.replayData.replay.records || [];

records.forEach((frameEvents, f) => {
    frameEvents.forEach(ev => {
        if (ev.objectId === "4427d089" || ev.sourceObjectId === "4427d089" || ev.tank === "Taoqi") {
            console.log(`Frame ${f}: Taoqi Event -> ${JSON.stringify(ev)}`);
        }
    });
});
