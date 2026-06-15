const fs = require('fs');
const data = JSON.parse(fs.readFileSync('replays/mat_CIAst2yusxsIhmLDI.json', 'utf8'));

const map = data.replayData.map;
const names = data.replayData.names; // [XDB, Yini Tank] or similar
console.log("Names:", names);

// 提取两个坦克的 ID
let xdbId = null;
let enemyId = null;
const records = data.replayData.replay.records;

for (let r of records) {
    for (let act of r) {
        if (act.type === 'speech') {
            if (act.text.includes("V12.60") || act.text.includes("传送")) {
                xdbId = act.objectId;
            }
        }
    }
}
// 寻找另一个 tank Id
for (let r of records) {
    for (let act of r) {
        if (act.type === 'tank' && act.objectId !== xdbId) {
            enemyId = act.objectId;
        }
    }
}

console.log("XDB objectId:", xdbId);
console.log("Enemy objectId:", enemyId);

// 跟踪状态
let xdbState = { pos: null, dir: null, hp: 3, bullet: null };
let enemyState = { pos: null, dir: null, hp: 3, bullet: null };
let starPos = null;

// 判断某个位置是否为草丛 'o'
function isGrass(pos) {
    if (!pos) return false;
    const val = map[pos[0]][pos[1]];
    return val === 'o';
}

console.log("\n--- Timeline of match CIAst2yusxsIhmLDI ---");
for (let frame = 0; frame < records.length; frame++) {
    const r = records[frame];
    let eventsText = [];
    let speaks = [];

    // 先处理初始化和位置更新事件，确保状态是最新的
    for (let act of r) {
        if (act.action === 'created') {
            if (act.type === 'star') starPos = act.position;
        }
        if (act.type === 'tank') {
            // tank 的转向或移动或创建
            if (act.action === 'created' || act.action === 'move' || act.action === 'turn') {
                let state = (act.objectId === xdbId) ? xdbState : enemyState;
                if (act.position) state.pos = act.position;
                if (act.direction) state.dir = act.direction;
                if (act.tank) {
                    if (act.tank.position) state.pos = act.tank.position;
                    if (act.tank.direction) state.dir = act.tank.direction;
                }
            }
        }
    }

    // 处理其他事件
    for (let act of r) {
        const who = (act.objectId === xdbId || act.by === 0) ? "XDB" : ((act.objectId === enemyId || act.by === 1) ? "Enemy" : "Other");
        
        if (act.type === 'speech') {
            speaks.push(`${who} spoke "${act.text}"`);
        } else if (act.type === 'skill') {
            eventsText.push(`${who} ${act.action} ${act.skillType}` + (act.to ? ` to [${act.to}]` : ''));
        } else if (act.type === 'tank') {
            if (act.action === 'move') {
                eventsText.push(`${who} moved to [${act.position}]`);
            } else if (act.action === 'turn') {
                eventsText.push(`${who} turned to ${act.direction}`);
            } else if (act.action === 'crashed') {
                eventsText.push(`${who} CRASHED`);
            }
        } else if (act.type === 'bullet') {
            if (act.action === 'created') {
                eventsText.push(`${who} fired bullet ${act.bulletId} dir ${act.direction} from [${act.position}]`);
            } else if (act.action === 'destroyed') {
                eventsText.push(`Bullet ${act.bulletId} destroyed at [${act.position}] reason: ${act.reason}`);
            }
        } else if (act.type === 'star' && act.action === 'collected') {
            eventsText.push(`${who} collected Star at [${act.position}]`);
        }
    }

    const xdbGrass = isGrass(xdbState.pos) ? " (in Grass)" : "";
    const enemyGrass = isGrass(enemyState.pos) ? " (in Grass)" : "";
    
    console.log(`\nFrame ${frame}: Star: ${starPos ? `[${starPos}]` : 'None'}`);
    console.log(`  XDB: ${xdbState.pos ? `[${xdbState.pos}]` : '?'}, Dir: ${xdbState.dir || '?'}${xdbGrass}`);
    console.log(`  Enemy: ${enemyState.pos ? `[${enemyState.pos}]` : '?'}, Dir: ${enemyState.dir || '?'}${enemyGrass}`);
    if (speaks.length > 0) {
        console.log(`  Speaks: ${speaks.join(', ')}`);
    }
    if (eventsText.length > 0) {
        console.log(`  Events:`);
        eventsText.forEach(e => console.log(`    - ${e}`));
    }
}
