const fs = require('fs');
const data = JSON.parse(fs.readFileSync('replays/mat_ILENCXeqjOt5bKUFn.json', 'utf8'));
const records = data.replayData.replay.records;

let out = '';
for (let frame = 0; frame < records.length; frame++) {
    out += `\n==================== Frame ${frame} ====================\n`;
    const r = records[frame];
    for (let act of r) {
        let cleanAct = { ...act };
        if (cleanAct.tank) {
            cleanAct.tank = { id: cleanAct.tank.id, position: cleanAct.tank.position, direction: cleanAct.tank.direction };
        }
        out += JSON.stringify(cleanAct) + '\n';
    }
}
fs.writeFileSync('scratch/frames_loss.txt', out);
console.log("Written scratch/frames_loss.txt");
