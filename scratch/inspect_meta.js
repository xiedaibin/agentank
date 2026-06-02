const fs = require('fs');
const path = require('path');

const matchId = 'mat_0tnLfXhzpKOD6AGBZ';
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, `${matchId}_raw.json`), 'utf8'));
const records = raw.replayData.replay.records || [];

console.log("--- Record 0 ---");
console.log(JSON.stringify(records[0], null, 2));

console.log("--- Meta ---");
console.log(JSON.stringify(raw.replayData.replay.meta, null, 2));
