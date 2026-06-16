const fs = require('fs');
const match = JSON.parse(fs.readFileSync('scratch/mat_0b4Bhk2Ljsx1gZOGK_raw.json', 'utf8'));
const map = match.replayData.map.map;
console.log("Classic map column 10 tiles:");
for (let y = 0; y < map[0].length; y++) {
    console.log(`[10, ${y}] = ${map[10][y]}`);
}




