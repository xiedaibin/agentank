const fs = require('fs');
const path = require('path');

const matchId = 'mat_0tnLfXhzpKOD6AGBZ';
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, `${matchId}_raw.json`), 'utf8'));
const records = raw.replayData.replay.records || [];

console.log("--- Frame 11 Events ---");
console.log(JSON.stringify(records[11], null, 2));

console.log("--- Frame 12 Events ---");
console.log(JSON.stringify(records[12], null, 2));

console.log("--- Frame 13 Events ---");
console.log(JSON.stringify(records[13], null, 2));
