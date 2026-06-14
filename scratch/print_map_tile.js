const fs = require('fs');
const data = JSON.parse(fs.readFileSync('targeted_evolution_replays/loss_3773_mat_KJKyDnrEZWRLRFitD.json', 'utf8'));
const map = data.replayData?.map?.map || data.replay?.meta?.map?.grid;
console.log("Map size:", map.length, "x", map[0].length);
console.log("Tile at [10, 5]:", map[10][5]);
console.log("Tile at [10, 6]:", map[10][6]);
console.log("Tile at [10, 4]:", map[10][4]);
console.log("Tile at [10, 3]:", map[10][3]);
