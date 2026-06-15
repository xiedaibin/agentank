const fs = require('fs');
const data = JSON.parse(fs.readFileSync('replays/mat_CIAst2yusxsIhmLDI_events.json', 'utf8'));
console.log("Events count:", data.events.length);
console.log("First 10 events:");
for (let i = 0; i < Math.min(data.events.length, 20); i++) {
    console.log(JSON.stringify(data.events[i]));
}
