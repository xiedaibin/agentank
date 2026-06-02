const fs = require('fs');
const path = require('path');

const matchId = 'mat_0tnLfXhzpKOD6AGBZ';
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, `${matchId}_raw.json`), 'utf8'));
const records = raw.replayData.replay.records || [];

const interestingActions = new Set(["applied", "removed", "cast", "crashed", "fire"]);
records.forEach((frameEvents, f) => {
    frameEvents.forEach(ev => {
        if (interestingActions.has(ev.action) || interestingActions.has(ev.event) || ev.skill || ev.debuff) {
            console.log(`Frame ${f}: ${JSON.stringify(ev)}`);
        }
    });
});
