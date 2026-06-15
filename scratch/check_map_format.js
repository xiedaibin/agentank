const fs = require('fs');
const data = JSON.parse(fs.readFileSync('replays/mat_CIAst2yusxsIhmLDI.json', 'utf8'));
const map = data.replayData.map;
console.log("Type of map:", typeof map);
console.log("Map keys:", Object.keys(map));
console.log("Map cells count:", map.cells ? map.cells.length : 'no cells');
if (map.cells) {
    console.log("First 3 cells:", map.cells.slice(0, 3));
    console.log("Map cols/rows:", map.cols, map.rows);
} else {
    console.log("Map direct:", map);
}
