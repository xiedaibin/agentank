const fs = require('fs');
const data = JSON.parse(fs.readFileSync('targeted_evolution_replays/loss_3773_mat_LRLHm4GB0t1FsfI6k.json', 'utf8'));
const map = data.replayData?.map?.map || data.replay?.meta?.map?.grid;
console.log("Map size:", map.length, "x", map[0].length);
for (let x = 4; x <= 7; x++) {
    console.log(`Tile at [${x}, 8]:`, map[x][8]);
}
