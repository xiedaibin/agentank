const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'mat_0tnLfXhzpKOD6AGBZ_raw.json'), 'utf8'));
const records = raw.replayData.replay.records || [];

let xdbPos = [16, 12]; 
let xdbDir = "down";   
let taoqiPos = [2, 2]; 
let taoqiDir = "up";   

const xdbId = "fe548ee8"; // from our speak log objectId
let taoqiId = "4427d089"; // Challenger is Taoqi

function getNewDirection(currentDir, turn) {
    const dirs = ["up", "right", "down", "left"];
    const idx = dirs.indexOf(currentDir);
    if (idx === -1) return currentDir;
    if (turn === "left") return dirs[(idx - 1 + 4) % 4];
    if (turn === "right") return dirs[(idx + 1) % 4];
    return currentDir;
}

console.log(`\n================= Frame-by-Frame Trace (Corrected) =================`);

for (let f = 1; f < records.length; f++) {
    const frameEvents = records[f] || [];
    let xdbAction = "";
    let taoqiAction = "";
    let bulletEvents = [];
    let starEvents = [];

    for (const ev of frameEvents) {
        // Resolve tank name
        let isXDB = false;
        let isTaoqi = false;

        if (ev.tank === "XDB" || ev.objectId === xdbId || ev.sourceObjectId === xdbId || ev.by === 1) {
            isXDB = true;
        } else if (ev.tank === "Taoqi" || ev.objectId === taoqiId || ev.sourceObjectId === taoqiId || ev.by === 0) {
            isTaoqi = true;
        }

        if (isXDB) {
            if (ev.action === "go" || ev.event === "move") {
                xdbPos = ev.position || ev.to;
                xdbAction = `move to ${JSON.stringify(xdbPos)}`;
            } else if (ev.action === "turn" || ev.event === "turn") {
                xdbDir = getNewDirection(xdbDir, ev.direction);
                xdbAction = `turn ${ev.direction} (now ${xdbDir})`;
            } else if (ev.action === "cast" && (ev.skill === "teleport" || ev.skillType === "teleport")) {
                xdbAction = `cast teleport`;
            } else if (ev.action === "applied" && (ev.skill === "teleport" || ev.skillType === "teleport")) {
                xdbPos = ev.to || ev.position;
                xdbAction = `teleported to ${JSON.stringify(xdbPos)}`;
            } else if (ev.event === "fire" || ev.action === "fire") {
                xdbAction = `FIRE direction ${ev.direction}`;
            } else if (ev.action === "say") {
                xdbAction += ` (SPEAK "${ev.text}")`;
            } else if (ev.event === "crashed") {
                xdbAction = `CRASHED`;
            }
        } else if (isTaoqi) {
            if (ev.action === "go" || ev.event === "move") {
                taoqiPos = ev.position || ev.to;
                taoqiAction = `move to ${JSON.stringify(taoqiPos)}`;
            } else if (ev.action === "turn" || ev.event === "turn") {
                taoqiDir = getNewDirection(taoqiDir, ev.direction);
                taoqiAction = `turn ${ev.direction} (now ${taoqiDir})`;
            } else if (ev.event === "fire" || ev.action === "fire") {
                taoqiAction = `FIRE direction ${ev.direction}`;
            } else if (ev.event === "crashed") {
                taoqiAction = `CRASHED`;
            }
        } else {
            // Bullet or star
            if (ev.type === "bullet") {
                bulletEvents.push(`${ev.action || ev.event} ${ev.bullet || ev.objectId} [${ev.position}]`);
            } else if (ev.type === "star" || ev.event === "star_spawned" || ev.event === "star_collected" || ev.action === "collected") {
                starEvents.push(`${ev.event || ev.action} by ${ev.by === 1 ? 'XDB' : 'Taoqi'} at ${ev.at || ev.position}`);
            }
        }
    }

    console.log(`Frame ${f}:`);
    console.log(`  XDB   : Pos=${JSON.stringify(xdbPos)} Dir=${xdbDir.padEnd(5)} | Action: ${xdbAction}`);
    console.log(`  Taoqi : Pos=${JSON.stringify(taoqiPos)} Dir=${taoqiDir.padEnd(5)} | Action: ${taoqiAction}`);
    if (bulletEvents.length > 0) console.log(`  Bullets: ${bulletEvents.join(', ')}`);
    if (starEvents.length > 0) console.log(`  Stars  : ${starEvents.join(', ')}`);
}
