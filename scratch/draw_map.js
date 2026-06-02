const fs = require('fs');
const path = require('path');

const matchId = 'mat_0tnLfXhzpKOD6AGBZ';
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, `${matchId}_raw.json`), 'utf8'));
const map = raw.replayData.map.map;

const w = map.length;
const h = map[0].length;

console.log("Map Grid (x horizontal 0 to w-1, y vertical 0 to h-1):");
for (let y = 0; y < h; y++) {
    let rowStr = "";
    for (let x = 0; x < w; x++) {
        const tile = map[x][y];
        if (tile === "o") {
            rowStr += "░"; // Grass
        } else if (tile === "x") {
            rowStr += "█"; // Wall
        } else if (tile === "m") {
            rowStr += "▓"; // Mound
        } else {
            rowStr += "."; // Open
        }
    }
    console.log(`${y.toString().padStart(2)}: ${rowStr}`);
}
