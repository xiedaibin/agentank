const fs = require('fs');
const path = require('path');

const matchId = "mat_A2JF1Dc0smH8PRNpx";
const rawPath = path.join(__dirname, `${matchId}_raw.json`);
const summaryPath = path.join(__dirname, `${matchId}_summary.json`);

if (!fs.existsSync(rawPath)) {
    console.error("Match JSON not found in scratch.");
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const records = raw.replayData.replay.records || [];
const map = raw.replayData.map.map;

const defender = summary.participants.defender;
const challenger = summary.participants.challenger;
let meId = null;
if (defender && defender.tankName === "XDB") {
    meId = raw.replayData.replay.meta.players[1].tank.id;
} else {
    meId = raw.replayData.replay.meta.players[0].tank.id;
}

let p0 = raw.replayData.replay.meta.players[0];
let p1 = raw.replayData.replay.meta.players[1];
const meIndex = p0.tank.id === meId ? 0 : 1;
const enemyIndex = 1 - meIndex;

let mePos = meIndex === 0 ? p0.tank.position.slice() : p1.tank.position.slice();
let meDir = meIndex === 0 ? p0.tank.direction : p1.tank.direction;
let enemyPos = meIndex === 0 ? p1.tank.position.slice() : p0.tank.position.slice();
let enemyDir = meIndex === 0 ? p1.tank.direction : p0.tank.direction;

// Scan events to keep position updated
for (let f = 1; f <= 70; f++) {
    const frameEvents = records[f] || [];
    let meAct = "stay";
    let enemyAct = "stay";

    for (const ev of frameEvents) {
        const isMe = (ev.objectId === meId || ev.sourceObjectId === meId || ev.targetObjectId === meId || ev.by === meIndex);
        const isEnemy = !isMe && (ev.objectId || ev.sourceObjectId || ev.targetObjectId || ev.by !== undefined);

        if (isMe) {
            if (ev.action === "go" || ev.event === "move") {
                mePos = ev.position || ev.to;
                meAct = `move to [${mePos}]`;
            } else if (ev.action === "turn" || ev.event === "turn") {
                meAct = `turn ${ev.direction}`;
            } else if (ev.action === "applied" && ev.skillType === "teleport") {
                mePos = ev.to;
                meAct = `teleport to [${mePos}]`;
            } else if (ev.event === "fire" || ev.action === "fire") {
                meAct = `fire`;
            }
        } else {
            // Note: enemy can also move/turn/teleport
            if (ev.action === "go" || ev.event === "move") {
                enemyPos = ev.position || ev.to;
                enemyAct = `move to [${enemyPos}]`;
            } else if (ev.action === "turn" || ev.event === "turn") {
                enemyAct = `turn ${ev.direction}`;
            } else if (ev.action === "applied" && ev.skillType === "teleport") {
                enemyPos = ev.to;
                enemyAct = `teleport to [${enemyPos}]`;
            }
        }
    }

    if (f >= 50 && f <= 67) {
        const meTile = map[mePos[1]][mePos[0]];
        const enemyTile = map[enemyPos[1]][enemyPos[0]];
        console.log(`Frame ${f.toString().padStart(2, ' ')}: XDB at [${mePos}] tile='${meTile}' act=${meAct.padEnd(20)} | Enemy at [${enemyPos}] tile='${enemyTile}' act=${enemyAct}`);
    }
}
