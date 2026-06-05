const fs = require('fs');
const path = require('path');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'sim_res.json'), 'utf8'));
const map = raw.replayData.map.map;
console.log("Map around X=8, Y=13:");
for (let y = 11; y <= 14; y++) {
    let row = '';
    for (let x = 5; x <= 11; x++) {
        row += map[x] ? map[x][y] : '?';
    }
    console.log(`Y=${y}: ${row} (X=5..11)`);
}
