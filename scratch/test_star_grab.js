const fs = require('fs');
const path = require('path');

const matchId = 'mat_BVebIlAw5CD9zXqOI';
const rawPath = path.join(__dirname, `${matchId}_raw.json`);
const summaryPath = path.join(__dirname, `${matchId}_summary.json`);

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const records = raw.replayData.replay.records || [];
const map = raw.replayData.map.map;

const participants = summary.participants;
let meId = null;
let enemyId = null;
if (participants.defender && participants.defender.tankName === "XDB") {
    meId = raw.replayData.replay.meta.players[1].tank.id;
    enemyId = raw.replayData.replay.meta.players[0].tank.id;
} else {
    meId = raw.replayData.replay.meta.players[0].tank.id;
    enemyId = raw.replayData.replay.meta.players[1].tank.id;
}
const meIndex = raw.replayData.replay.meta.players[0].tank.id === meId ? 0 : 1;
const enemyIndex = 1 - meIndex;

let p0 = raw.replayData.replay.meta.players[0];
let p1 = raw.replayData.replay.meta.players[1];
let mePos = (p0.tank.id === meId ? p0.tank.position : p1.tank.position).slice();
let meDir = p0.tank.id === meId ? p0.tank.direction : p1.tank.direction;
let enemyPos = (p0.tank.id === meId ? p1.tank.position : p0.tank.position).slice();
let enemyDir = p0.tank.id === meId ? p1.tank.direction : p0.tank.direction;

let starPos = null;
for (const ev of (records[0] || [])) {
    if (ev.type === "star" || ev.event === "star_spawned" || (ev.action === "created" && ev.type === "star")) {
        starPos = ev.position || ev.at;
    }
}
let bulletsMap = new Map();

const COOLDOWNS = { shield: 25, freeze: 29, stun: 20, overload: 32, cloak: 35, poison: 20, teleport: 40, boost: 26 };
let enemySkillType = "cloak";
for (const frameEvents of records) {
    for (const ev of frameEvents) {
        if (ev.sourceObjectId === enemyId && ev.action === "cast" && ev.skillType) {
            enemySkillType = ev.skillType;
            break;
        }
    }
}

let meSkillCD = 0;
let enemySkillCD = 0;
let meStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
let enemyStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
let meFireLockTimer = 0;
let enemyFireLockTimer = 0;

function getNewDirection(currentDir, turn) {
    const dirs = ["up", "right", "down", "left"];
    const idx = dirs.indexOf(currentDir);
    if (idx === -1) return currentDir;
    if (turn === "left") return dirs[(idx - 1 + 4) % 4];
    if (turn === "right") return dirs[(idx + 1) % 4];
    return currentDir;
}

// 模拟状态并输出 Frame 13 到 23 的详细分析
for (let f = 1; f <= 23; f++) {
    const frameEvents = records[f] || [];
    if (meSkillCD > 0) meSkillCD--;
    if (enemySkillCD > 0) enemySkillCD--;
    if (meFireLockTimer > 0) { meFireLockTimer--; if (meFireLockTimer === 0) meStatus.fireLocked = false; }
    if (enemyFireLockTimer > 0) { enemyFireLockTimer--; if (enemyFireLockTimer === 0) enemyStatus.fireLocked = false; }

    for (const ev of frameEvents) {
        const isMe = (ev.objectId === meId || ev.sourceObjectId === meId || ev.targetObjectId === meId || ev.by === meIndex);
        const isEnemy = (ev.objectId === enemyId || ev.sourceObjectId === enemyId || ev.targetObjectId === enemyId || ev.by === enemyIndex);

        if (isMe) {
            if (ev.action === "go" || ev.event === "move") { mePos = ev.position || ev.to; }
            else if (ev.action === "turn" || ev.event === "turn") { meDir = getNewDirection(meDir, ev.direction); }
            else if (ev.action === "applied" && ev.skillType === "teleport") { mePos = ev.to; meStatus.fireLocked = true; meFireLockTimer = 2; }
        } else if (isEnemy) {
            if (ev.action === "go" || ev.event === "move") { enemyPos = ev.position || ev.to; }
            else if (ev.action === "turn" || ev.event === "turn") { enemyDir = getNewDirection(enemyDir, ev.direction); }
            else if (ev.action === "applied" && ev.skillType === "teleport") { enemyPos = ev.to; enemyStatus.fireLocked = true; enemyFireLockTimer = 2; }
        }

        if (ev.type === "bullet") {
            if (ev.action === "created") {
                bulletsMap.set(ev.objectId, { position: ev.position, direction: ev.direction || "up", shooterId: ev.tank ? ev.tank.id : null });
            } else if (ev.action === "go") {
                let b = bulletsMap.get(ev.objectId);
                if (b) { b.position = ev.position; if (ev.direction) b.direction = ev.direction; }
            } else if (ev.action === "crashed") {
                bulletsMap.delete(ev.objectId);
            }
        }

        if (ev.type === "star" || ev.event === "star_spawned" || ev.action === "created" && ev.type === "star") { starPos = ev.position || ev.at; }
        if (ev.event === "star_collected" || ev.action === "collected") { starPos = null; }

        if (ev.action === "cast" && ev.type === "skill") {
            if (isMe) meSkillCD = COOLDOWNS[ev.skillType] || 32;
            else enemySkillCD = COOLDOWNS[ev.skillType] || 32;
        }

        if (ev.action === "applied") {
            const targetObj = ev.targetObjectId;
            const stat = targetObj === meId ? meStatus : enemyStatus;
            const sType = ev.skillType;
            const dType = ev.debuffType;
            if (sType === "shield") stat.shielded = true;
            if (sType === "cloak") stat.cloaked = true;
            if (sType === "boost") stat.boosted = true;
            if (sType === "overload") stat.overloaded = true;
            if (sType === "freeze" || dType === "frozen") stat.frozen = true;
            if (sType === "stun" || dType === "stunned") stat.stunned = true;
        }
        if (ev.action === "removed" || ev.action === "expired") {
            const targetObj = ev.targetObjectId;
            const stat = targetObj === meId ? meStatus : enemyStatus;
            const sType = ev.skillType;
            const dType = ev.debuffType;
            if (sType === "shield") stat.shielded = false;
            if (sType === "cloak") stat.cloaked = false;
            if (sType === "boost") stat.boosted = false;
            if (sType === "overload") stat.overloaded = false;
            if (sType === "freeze" || dType === "frozen") stat.frozen = false;
            if (sType === "stun" || dType === "stunned") stat.stunned = false;
        }
    }

    if (f >= 13 && f <= 23) {
        console.log(`\n------------------ Frame ${f} ------------------`);
        console.log(`  XDB: Pos=[${mePos}] Dir=${meDir} CD=${meSkillCD}`);
        console.log(`  AME: Pos=[${enemyPos}] Dir=${enemyDir} CD=${enemySkillCD} (Visible: ${!enemyStatus.cloaked})`);
        console.log(`  Star: [${starPos}]`);

        // 加载并运行 new_tank.js
        const newTankCode = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');
        const sandbox = {
            console: console,
            print: console.log,
            G_Blueprint: {},
            G_History: {},
            CONFIG: { KILL_PRIO: 10000, STAR_PRIO: 800, TURN_COST: 0.8, BLIND_FIRE_FRAMES: 3 }
        };

        const runCode = new Function('sandbox', `
            with (sandbox) {
                ${newTankCode}
                sandbox.onIdle = onIdle;
                sandbox.G_Blueprint = G_Blueprint;
                sandbox.G_History = G_History;
                sandbox.buildExecutionContext = buildExecutionContext;
                sandbox.evalStarCollection = evalStarCollection;
                sandbox.evalGrassAmbushAndSurvival = evalGrassAmbushAndSurvival;
                sandbox.evalStarGuard = evalStarGuard;
                sandbox.tacticalAnalysis = tacticalAnalysis;
            }
        `);
        runCode(sandbox);

        // 设置环境状态
        sandbox.G_Blueprint.initialized = true;
        sandbox.G_Blueprint.enemySeen = true;
        sandbox.G_Blueprint.enemyProfile = { skillType: enemySkillType, hasOverload: false };
        sandbox.G_Blueprint.mapVision = { cover: {}, grass: {}, grassList: [] };
        for (let x = 0; x < map.length; x++) {
            for (let y = 0; y < map[0].length; y++) {
                if (map[x][y] === 'x') sandbox.G_Blueprint.mapVision.cover[x+','+y] = true;
                if (map[x][y] === 'o') {
                    sandbox.G_Blueprint.mapVision.grass[x+','+y] = true;
                    sandbox.G_Blueprint.mapVision.grassList.push([x,y]);
                }
            }
        }
        sandbox.G_Blueprint.Tactics = { STANCE: "ANTI_CLOAK", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 1500, ENABLE_ASSASSINATION: true, MAX_NODES: 200 };

        sandbox.G_History.frame = f;
        sandbox.G_History.lastEnemyPos = enemyPos.slice();
        sandbox.G_History.lastEnemyDir = enemyDir;
        sandbox.G_History.lastEnemySeenFrame = f - 1; // 假定最近看到
        sandbox.G_History.lastEnemyVisible = !enemyStatus.cloaked;
        sandbox.G_History.wasEnemyVisible = true;
        sandbox.G_History.enemyInvisibleFrames = 0;
        sandbox.G_History.lastUpdatedFrame = f;

        const meObj = {
            tank: { id: meId, position: mePos.slice(), direction: meDir, crashed: false },
            stars: 3,
            bullet: null,
            skill: { type: "teleport", cooldownFrames: 40, remainingCooldownFrames: meSkillCD },
            status: Object.assign({}, meStatus),
            speak: function(text) { console.log(`    [Speak] ${text}`); }
        };

        const enemyObj = {
            tank: !enemyStatus.cloaked ? { id: enemyId, position: enemyPos.slice(), direction: enemyDir, crashed: false } : null,
            bullet: null,
            stars: 3,
            skill: { type: enemySkillType, cooldownFrames: 35, remainingCooldownFrames: enemySkillCD },
            status: Object.assign({}, enemyStatus)
        };

        const gameObj = { map: map, star: starPos ? starPos.slice() : null, frames: f };

        const ctx = sandbox.buildExecutionContext(meObj, enemyObj, gameObj);
        
        // 评估各个子战术
        const starRes = sandbox.evalStarCollection(ctx);
        const ambushRes = sandbox.evalGrassAmbushAndSurvival(ctx);
        const guardRes = sandbox.evalStarGuard(ctx);
        const bestAction = sandbox.tacticalAnalysis(ctx);

        console.log(`    evalStarCollection            : ${JSON.stringify(starRes)}`);
        console.log(`    evalGrassAmbushAndSurvival    : ${JSON.stringify(ambushRes)}`);
        console.log(`    evalStarGuard                 : ${JSON.stringify(guardRes)}`);
        console.log(`    TACTICAL ANALYSIS CHOICE       : ${JSON.stringify(bestAction)}`);
    }
}
