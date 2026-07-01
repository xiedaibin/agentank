const fs = require('fs');
const path = require('path');

const matchId = 'mat_BVebIlAw5CD9zXqOI';
// 路径定位到项目内的 scratch 目录
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

// 模拟状态直到第 124 帧
for (let f = 1; f <= 124; f++) {
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

    if (f === 124) {
        console.log(`\n=================== FRAME 124 ANALYSIS ===================`);
        console.log(`XDB Position : [${mePos}] Direction : ${meDir}`);
        console.log(`Enemy Position : [${enemyPos}] Direction : ${enemyDir}`);
        
        // 运行 XDB 的 new_tank.js 中的逻辑进行对比
        const newTankCode = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');
        const sandbox = {
            console: console,
            print: console.log,
            G_Blueprint: {},
            G_History: {},
            CONFIG: { BLIND_FIRE_FRAMES: 3 }
        };

        const runCode = new Function('sandbox', `
            with (sandbox) {
                ${newTankCode}
                sandbox.onIdle = onIdle;
                sandbox.G_Blueprint = G_Blueprint;
                sandbox.G_History = G_History;
                sandbox.CONFIG = CONFIG;
                sandbox.buildExecutionContext = buildExecutionContext;
                sandbox.getEnemyPredictedPath = getEnemyPredictedPath;
                sandbox.evalPathAmbushFire = evalPathAmbushFire;
                sandbox.strategicInit = strategicInit;
                sandbox.isPassable = isPassable;
                sandbox.getDist = getDist;
                sandbox.directionTo = directionTo;
                sandbox.isLoS = isLoS;
            }
        `);
        runCode(sandbox);

        // 模拟 G_History 在 124 帧之前的状态
        sandbox.G_Blueprint.initialized = true;
        sandbox.G_Blueprint.enemySeen = true;
        sandbox.G_Blueprint.enemyProfile = { skillType: enemySkillType, hasOverload: false };
        sandbox.G_Blueprint.mapVision = {
            cover: {},
            grass: {},
            grassList: []
        };
        // 填充 mapVision
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

        sandbox.G_History.frame = 124;
        sandbox.G_History.lastEnemyPos = [11, 7]; // Frame 123的位置
        sandbox.G_History.lastEnemyDir = "right";
        sandbox.G_History.lastEnemySeenFrame = 123;
        sandbox.G_History.lastEnemyVisible = true; // Frame 123 可见
        sandbox.G_History.wasEnemyVisible = true;
        sandbox.G_History.enemyInvisibleFrames = 1; // 124 帧不可见，所以 invisibleFrames 是 1

        const enemyInGrass = !!sandbox.G_Blueprint.mapVision.grass[enemyPos[0] + "," + enemyPos[1]];
        const enemyVisible = !enemyStatus.cloaked && !enemyInGrass;

        const meObj = {
            tank: { id: meId, position: mePos.slice(), direction: meDir, crashed: false },
            stars: 3,
            bullet: null,
            skill: { type: "teleport", cooldownFrames: 40, remainingCooldownFrames: 0 },
            status: Object.assign({}, meStatus),
            speak: function(text) { console.log(`[Tank Speak] ${text}`); }
        };

        const enemyObj = {
            // 当敌人不可见时，传入的 enemy.tank 在原引擎中会被处理为 null！
            tank: enemyVisible ? { id: enemyId, position: enemyPos.slice(), direction: enemyDir, crashed: false } : null,
            bullet: null,
            stars: 3,
            skill: { type: enemySkillType, cooldownFrames: 35, remainingCooldownFrames: enemySkillCD },
            status: Object.assign({}, enemyStatus)
        };

        const gameObj = { map: map, star: starPos ? starPos.slice() : null, frames: 124 };

        console.log(`Enemy Visible in Simulation: ${enemyVisible}`);
        console.log(`Enemy Object passed to onIdle: ${JSON.stringify(enemyObj)}`);

        const ctx = sandbox.buildExecutionContext(meObj, enemyObj, gameObj);
        console.log(`ctx.enemy = ${JSON.stringify(ctx.enemy)}`);
        console.log(`ctx.enemyPos = ${JSON.stringify(ctx.enemyPos)}`);
        console.log(`ctx.isEnemyRecentlyInvisibleInGrass = ${ctx.isEnemyRecentlyInvisibleInGrass}`);

        // 我们手动跟踪 evalPathAmbushFire 里的变量
        console.log(`--- Tracing evalPathAmbushFire ---`);
        const isCurrentlyInGrass = sandbox.G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
        console.log(`Is XDB currently in grass? ${!!isCurrentlyInGrass}`);
        
        const enemyPath = sandbox.getEnemyPredictedPath(ctx.enemyPos, ctx.enemyDir, ctx.starPos, ctx.map);
        console.log(`Enemy predicted path length: ${enemyPath.length}`);
        if (enemyPath.length > 0) {
            console.log(`Enemy predicted path: ${JSON.stringify(enemyPath)}`);
            for (let i = 0; i < enemyPath.length; i++) {
                const node = enemyPath[i];
                if (node.pos[0] === 14 && node.pos[1] === 7) {
                    console.log(`Node [14,7] found in path:`, node);
                    const d = sandbox.getDist(ctx.myPos, node.pos);
                    console.log(`  Distance to [14,7]: ${d}`);
                    const dir = sandbox.directionTo(ctx.myPos, node.pos);
                    console.log(`  Direction to [14,7]: ${dir}`);
                    const isCoAxial = (ctx.myPos[0] === node.pos[0] || ctx.myPos[1] === node.pos[1]);
                    console.log(`  Is Co-axial: ${isCoAxial}`);
                    const isLos = sandbox.isLoS(ctx.myPos, node.pos, dir, ctx.map);
                    console.log(`  Is LoS clear: ${isLos}`);
                    const isMyDirSame = (ctx.myDir === dir);
                    console.log(`  Is My Direction same: ${isMyDirSame}`);
                    
                    const T_bullet = Math.ceil(d / 2);
                    const enemySpeed = 1;
                    let T_enemy = Math.ceil(node.step / enemySpeed);
                    if (ctx.enemyDir && node.dir && ctx.enemyDir !== node.dir) {
                        T_enemy += 1;
                    }
                    console.log(`  T_bullet: ${T_bullet}, T_enemy: ${T_enemy}`);
                    const isEnemyCoAxialWithUs = (ctx.enemyPos[0] === ctx.myPos[0] || ctx.enemyPos[1] === ctx.myPos[1]);
                    console.log(`  Is Enemy Co-axial with us currently: ${isEnemyCoAxialWithUs}`);
                    let shouldFire = false;
                    if (isEnemyCoAxialWithUs) {
                        const dirToTargetFromEnemy = sandbox.directionTo(ctx.enemyPos, node.pos);
                        if (ctx.enemyDir === dirToTargetFromEnemy) {
                            if (T_enemy >= T_bullet) shouldFire = true;
                        }
                    } else {
                        if (T_enemy === T_bullet) shouldFire = true;
                    }
                    console.log(`  Should Fire at [14,7]: ${shouldFire}`);
                }
            }
        }
        
        const ambushFireResult = sandbox.evalPathAmbushFire(ctx);
        console.log(`evalPathAmbushFire(ctx) returned: ${JSON.stringify(ambushFireResult)}`);
    }
}
