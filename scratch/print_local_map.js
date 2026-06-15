const fs = require('fs');
const data = JSON.parse(fs.readFileSync('replays/mat_ILENCXeqjOt5bKUFn.json', 'utf8'));
const map = data.replayData.map.map;

const w = map.length;
const h = map[0].length;

console.log(`Map dimensions: ${w}x${h}`);
// 打印地图，行是 y，列是 x
for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
        row += map[x][y] + ' ';
    }
    console.log(`${y.toString().padStart(2)}: ${row}`);
}
