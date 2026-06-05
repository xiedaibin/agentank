const fs = require('fs');
const path = require('path');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'mat_ILdoyUNzqDLD2VXkj_raw.json'), 'utf8'));
const map = raw.replayData.map.map;
console.log("Map dimensions:", map.length, "x", map[0].length);
for (let y = 8; y <= 12; y++) {
    let row = '';
    for (let x = 12; x <= 18; x++) {
        row += (map[x] && map[x][y]) ? map[x][y] : '?';
    }
    console.log(`Y=${y}: ${row} (X=12..18)`);
}
