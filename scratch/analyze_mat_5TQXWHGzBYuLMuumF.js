const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'mat_5TQXWHGzBYuLMuumF_raw.json'), 'utf8'));
const records = data.replayData.replay.records;

console.log("Total records/frames:", records.length);

// XDB and Agro player info
const players = data.replayData.replay.meta.players;
console.log("Players configuration:");
players.forEach((p, idx) => {
    console.log(`  Player Index ${idx}: Tank ID=${p.tank.id}, Name=${p.tank.name || '?'}, Start Pos=${JSON.stringify(p.tank.position)}, Dir=${p.tank.direction}`);
});

let out = '';
for (let frame = 0; frame < records.length; frame++) {
    out += `\n==================== Frame ${frame} ====================\n`;
    const r = records[frame];
    for (let act of r) {
        let cleanAct = { ...act };
        if (cleanAct.tank) {
            cleanAct.tank = { id: cleanAct.tank.id, name: cleanAct.tank.name, position: cleanAct.tank.position, direction: cleanAct.tank.direction };
        }
        out += JSON.stringify(cleanAct) + '\n';
    }
}

fs.writeFileSync(path.join(__dirname, 'mat_5TQXWHGzBYuLMuumF_debug.txt'), out);
console.log("Detailed trace written to scratch/mat_5TQXWHGzBYuLMuumF_debug.txt");

// Let's also print the last 15 frames to console to examine immediately
const startFrame = Math.max(0, records.length - 15);
console.log(`\n--- Last ${records.length - startFrame} frames events ---`);
for (let frame = startFrame; frame < records.length; frame++) {
    console.log(`\nFrame ${frame}:`);
    for (let act of records[frame]) {
        let text = `  Action: ${act.action || act.event || act.type}`;
        if (act.objectId) text += `, ObjId: ${act.objectId}`;
        if (act.type) text += `, Type: ${act.type}`;
        if (act.sourceObjectId) text += `, SourceObjId: ${act.sourceObjectId}`;
        if (act.targetObjectId) text += `, TargetObjId: ${act.targetObjectId}`;
        if (act.position) text += `, Position: ${JSON.stringify(act.position)}`;
        if (act.to) text += `, To: ${JSON.stringify(act.to)}`;
        if (act.direction) text += `, Dir: ${act.direction}`;
        if (act.at) text += `, At: ${JSON.stringify(act.at)}`;
        if (act.tank) text += `, TankPos: ${JSON.stringify(act.tank.position)}, TankDir: ${act.tank.direction}`;
        if (act.value) text += `, Value: ${JSON.stringify(act.value)}`;
        if (act.text) text += `, Text: ${act.text}`;
        console.log(text);
    }
}
