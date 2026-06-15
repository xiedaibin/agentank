const fs = require('fs');
const content = fs.readFileSync('replays/mat_DvzvxbIwbI02dLWpq.json', 'utf8');
const data = JSON.parse(content);

const replay = data.replayData ? data.replayData.replay : null;
if (!replay) {
    console.log("No replay found");
    return;
}

console.log("Keys in replay:", Object.keys(replay));
// usually replay is an array of frames, or has a "records" or "frames" key
const list = Array.isArray(replay) ? replay : (replay.records || replay.frames || []);
console.log("Total frames/records:", list.length);

for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const frame = r.frame !== undefined ? r.frame : i;
    if (frame >= 8 && frame <= 11) {
        console.log(`\n--- Record Frame ${frame} ---`);
        console.log("Structure:", JSON.stringify(r, null, 2));
    }
}
