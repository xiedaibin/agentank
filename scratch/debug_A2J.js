const fs = require('fs');
const path = require('path');

const matchId = "mat_A2JF1Dc0smH8PRNpx";
const cachePath = path.join(__dirname, `${matchId}_raw.json`);

if (!fs.existsSync(cachePath)) {
    console.error("Match JSON not found at:", cachePath);
    process.exit(1);
}

const match = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
const map = match.replayData.map.map;

console.log("Map layout:");
for (let y = 0; y < map.length; y++) {
    let row = '';
    for (let x = 0; x < map[y].length; x++) {
        row += map[y][x];
    }
    console.log(`${y.toString().padStart(2, '0')}: ${row}`);
}

console.log("\nTile at [2,9]:", map[9][2]);
console.log("Tile at [2,8]:", map[8][2]);
console.log("Tile at [2,7]:", map[7][2]);
console.log("Tile at [2,6]:", map[6][2]);
