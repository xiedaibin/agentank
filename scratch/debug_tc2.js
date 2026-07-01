const fs = require('fs');
const path = require('path');

const matchId = 'mat_BVebIlAw5CD9zXqOI';
const replayRaw = JSON.parse(fs.readFileSync(path.join(__dirname, `../test_cases/replays/${matchId}.json`), 'utf8'));

// 从 run_tests.js 复制 simulateToFrame 和依赖
const COOLDOWNS = { shield: 25, freeze: 29, stun: 20, overload: 32, cloak: 35, poison: 20, teleport: 40, boost: 26 };

function getNewDirection(currentDir, turn) {
    const dirs = ["up", "right", "down", "left"];
    const idx = dirs.indexOf(currentDir);
    if (idx === -1) return currentDir;
    if (turn === "left") return dirs[(idx - 1 + 4) % 4];
    if (turn === "right") return dirs[(idx + 1) % 4];
    return currentDir;
}

function simulateToFrame(replayRaw, targetFrame) {
    const meta = replayRaw.replayData.replay.meta;
    const records = replayRaw.replayData.replay.records || [];
    const participants = replayRaw.summary ? replayRaw.summary.participants : null;

    let meId = null;
    let enemyId = null;
    
    if (participants) {
        if (participants.defender && participants.defender.tankName === "XDB") {
            meId = meta.players[1].tank.id;
            enemyId = meta.players[0].tank.id;
        } else {
            meId = meta.players[0].tank.id;
            enemyId = meta.players[1].tank.id;
        }
    } else {
        if (meta.players[0].tank.name === 'XDB') {
            meId = meta.players[0].tank.id;
            enemyId = meta.players[1].tank.id;
        } else {
            meId = meta.players[1].tank.id;
            enemyId = meta.players[0].tank.id;
        }
    }

    const meIndex = meta.players[0].tank.id === meId ? 0 : 1;
    const enemyIndex = 1 - meIndex;

    let p0 = meta.players[0];
    let p1 = meta.players[1];
    
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
    let enemySkillType = "none";
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

    for (let f = 1; f <= targetFrame; f++) {
        if (meSkillCD > 0) meSkillCD--;
        if (enemySkillCD > 0) enemySkillCD--;
        if (meFireLockTimer > 0) { meFireLockTimer--; if (meFireLockTimer === 0) meStatus.fireLocked = false; }
        if (enemyFireLockTimer > 0) { enemyFireLockTimer--; if (enemyFireLockTimer === 0) enemyStatus.fireLocked = false; }

        const frameEvents = records[f] || [];
        for (const ev of frameEvents) {
            const isMe = (ev.objectId === meId || ev.sourceObjectId === meId || ev.targetObjectId === meId || ev.by === meIndex);
            const isEnemy = (ev.objectId === enemyId || ev.sourceObjectId === enemyId || ev.targetObjectId === enemyId || ev.by === enemyIndex);

            if (isMe) {
                if (ev.action === "go" || ev.event === "move") { mePos = (ev.position || ev.to).slice(); }
                else if (ev.action === "turn" || ev.event === "turn") { meDir = getNewDirection(meDir, ev.direction); }
                else if (ev.action === "applied" && ev.skillType === "teleport") { mePos = ev.to.slice(); meStatus.fireLocked = true; meFireLockTimer = 2; }
                else if (ev.action === "applied" && ev.skillType === "boost") { meStatus.boosted = true; }
                else if (ev.event === "boost_ended") { meStatus.boosted = false; }
                else if (ev.action === "applied" && ev.skillType === "overload") { meStatus.overloaded = true; }
                else if (ev.event === "overload_ended") { meStatus.overloaded = false; }
            } else if (isEnemy) {
                if (ev.action === "go" || ev.event === "move") { enemyPos = (ev.position || ev.to).slice(); }
                else if (ev.action === "turn" || ev.event === "turn") { enemyDir = getNewDirection(enemyDir, ev.direction); }
                else if (ev.action === "applied" && ev.skillType === "teleport") { enemyPos = ev.to.slice(); enemyStatus.fireLocked = true; enemyFireLockTimer = 2; }
                else if (ev.action === "applied" && ev.skillType === "boost") { enemyStatus.boosted = true; }
                else if (ev.event === "boost_ended") { enemyStatus.boosted = false; }
                else if (ev.action === "applied" && ev.skillType === "overload") { enemyStatus.overloaded = true; }
                else if (ev.event === "overload_ended") { enemyStatus.overloaded = false; }
            }

            if (ev.type === "bullet") {
                if (ev.action === "created" && ev.position) {
                    bulletsMap.set(ev.objectId, { position: ev.position.slice(), direction: ev.direction || "up" });
                } else if (ev.action === "go" && ev.position) {
                    let b = bulletsMap.get(ev.objectId);
                    if (b) { b.position = ev.position.slice(); if (ev.direction) b.direction = ev.direction; }
                } else if (ev.action === "crashed") {
                    bulletsMap.delete(ev.objectId);
                }
            }

            if (ev.type === "star" || ev.event === "star_spawned" || (ev.action === "created" && ev.type === "star")) {
                var pVal = ev.position || ev.at;
                if (pVal) starPos = pVal.slice();
            }
            if (ev.event === "star_collected" || ev.action === "collected") { starPos = null; }

            if (ev.action === "cast" && ev.type === "skill") {
                if (isMe) meSkillCD = COOLDOWNS[ev.skillType] || 40;
                else if (isEnemy) enemySkillCD = COOLDOWNS[ev.skillType] || 35;
            }
        }
    }

    return {
        meId, enemyId, enemyIndex,
        mePos, meDir, enemyPos, enemyDir, starPos,
        meSkillCD, enemySkillCD, meSkillType: "teleport", enemySkillType,
        meStatus, enemyStatus, meBullet: null, enemyBullet: null,
        map: replayRaw.replayData.map.map
    };
}

const simState = simulateToFrame(replayRaw, 124);

// 加载 new_tank.js 代码，并将其中的 evalPathAmbushFire 用 debug 版覆盖
let newTankCode = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');

// 注入 debug 函数
const debugEvalPathAmbushFire = `
function evalPathAmbushFire(ctx) {
    console.log("-> [Debug evalPathAmbushFire] Entered!");
    if (!ctx.enemyPos || !ctx.enemy) {
        console.log("-> [Debug evalPathAmbushFire] Intercepted 1: no enemyPos or enemy", ctx.enemyPos, !!ctx.enemy);
        return null;
    }

    var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
    if (!isCurrentlyInGrass) {
        console.log("-> [Debug evalPathAmbushFire] Intercepted 2: not currently in grass. myPos =", ctx.myPos);
        return null;
    }

    var startPos = ctx.enemyVisible ? ctx.enemyPos : (ctx.predictedEnemyPos || ctx.enemyPos);
    var startDir = ctx.enemyDir;
    console.log("-> [Debug evalPathAmbushFire] startPos =", startPos, "startDir =", startDir);

    var enemyPath = getEnemyPredictedPath(startPos, startDir, ctx.starPos, ctx.map);
    console.log("-> [Debug evalPathAmbushFire] enemyPath.length =", enemyPath.length, JSON.stringify(enemyPath));
    if (enemyPath.length === 0) return null;

    var bestInterception = null;
    for (var i = 0; i < enemyPath.length; i++) {
        var node = enemyPath[i];
        console.log("-> [Debug evalPathAmbushFire] Checking Node", node.pos, "step =", node.step);

        if (ctx.starPos && samePos(ctx.myPos, ctx.starPos)) {
            console.log("-> [Debug evalPathAmbushFire] Skip: on star pos");
            continue;
        }

        var d = getDist(ctx.myPos, node.pos);
        if (d < 1 || d > 7) {
            console.log("-> [Debug evalPathAmbushFire] Skip: distance =", d);
            continue;
        }

        var dir = directionTo(ctx.myPos, node.pos);
        var isCoAxial = (ctx.myPos[0] === node.pos[0] || ctx.myPos[1] === node.pos[1]);
        if (!isCoAxial) {
            console.log("-> [Debug evalPathAmbushFire] Skip: not CoAxial");
            continue;
        }
        if (isLoS(ctx.myPos, node.pos, dir, ctx.map) === false) {
            console.log("-> [Debug evalPathAmbushFire] Skip: no LoS");
            continue;
        }

        if (ctx.myDir !== dir) {
            console.log("-> [Debug evalPathAmbushFire] Skip: myDir !== dir (", ctx.myDir, "!=", dir, ")");
            continue;
        }

        var T_bullet = Math.ceil(d / 2);
        var enemySpeed = 1;
        if (ctx.enemy.skill && ctx.enemy.skill.type === "boost") {
            var isEnemyBoosted = ctx.enemy.status && ctx.enemy.status.boosted;
            var isEnemyBoostReady = ctx.enemy.skill.remainingCooldownFrames === 0;
            if (isEnemyBoosted || isEnemyBoostReady) {
                enemySpeed = 2;
            }
        }
        var T_enemy = Math.ceil(node.step / enemySpeed);

        if (startDir && node.dir) {
            if (startDir !== node.dir) {
                T_enemy += 1;
            }
        }

        var isEnemyCoAxialWithUs = (startPos[0] === ctx.myPos[0] || startPos[1] === ctx.myPos[1]);
        var shouldFire = false;
        console.log("-> [Debug evalPathAmbushFire] T_enemy =", T_enemy, "T_bullet =", T_bullet, "isEnemyCoAxialWithUs =", isEnemyCoAxialWithUs);

        if (isEnemyCoAxialWithUs) {
            var dirToTargetFromEnemy = directionTo(startPos, node.pos);
            if (startDir === dirToTargetFromEnemy) {
                if (T_enemy >= T_bullet) {
                    shouldFire = true;
                }
            }
        } else {
            if (T_enemy === T_bullet) {
                shouldFire = true;
            }
        }

        console.log("-> [Debug evalPathAmbushFire] shouldFire =", shouldFire);

        if (shouldFire) {
            if (bestInterception === null || node.step < bestInterception.step) {
                bestInterception = {
                    targetPos: node.pos,
                    T_enemy: T_enemy,
                    T_bullet: T_bullet
                };
            }
        }
    }

    if (bestInterception) {
        console.log("-> [Debug evalPathAmbushFire] FOUND bestInterception =", bestInterception);
        if (!ctx.me.bullet && !ctx.meStatus.fireLocked) {
            return { action: "fire", target: bestInterception.targetPos, score: 2200, type: "ambush_fire" };
        } else {
            console.log("-> [Debug evalPathAmbushFire] Fire blocked by me.bullet =", !!ctx.me.bullet, "or fireLocked =", ctx.meStatus.fireLocked);
        }
    }
    return null;
}
`;

// 替换 evalPathAmbushFire 定义
const startIdx = newTankCode.indexOf('function evalPathAmbushFire');
if (startIdx !== -1) {
    // 寻找下一个 function 或者是闭包，简单粗暴直接把 debugEvalPathAmbushFire 附加在前面，并且把原版改名
    newTankCode = newTankCode.replace('function evalPathAmbushFire', 'function original_evalPathAmbushFire') + "\n\n" + debugEvalPathAmbushFire;
}

// 构造沙盒并执行
const sandbox = {
    console: console,
    print: console.log,
    G_Blueprint: {},
    G_History: {},
    CONFIG: { KILL_PRIO: 10000, STAR_PRIO: 800, TURN_COST: 0.8, BLIND_FIRE_FRAMES: 3 }
};

let recordedAction = null;
const runCode = new Function('sandbox', `
    with (sandbox) {
        ${newTankCode}
        sandbox.onIdle = onIdle;
        sandbox.buildExecutionContext = buildExecutionContext;
        sandbox.tacticalAnalysis = tacticalAnalysis;
        sandbox.executeAction = function(me, bestAction, ctx) {
            recordedAction = bestAction;
        };
    }
`);
runCode(sandbox);

// 灌入 G_Blueprint 静态状态
sandbox.G_Blueprint.initialized = true;
sandbox.G_Blueprint.enemySeen = true;
sandbox.G_Blueprint.enemyProfile = { skillType: simState.enemySkillType, hasOverload: (simState.enemySkillType === 'overload') };
sandbox.G_Blueprint.mapVision = { cover: {}, grass: {}, grassList: [] };
for (let x = 0; x < simState.map.length; x++) {
    for (let y = 0; y < simState.map[0].length; y++) {
        if (simState.map[x][y] === 'x') sandbox.G_Blueprint.mapVision.cover[x+','+y] = true;
        if (simState.map[x][y] === 'o') {
            sandbox.G_Blueprint.mapVision.grass[x+','+y] = true;
            sandbox.G_Blueprint.mapVision.grassList.push([x,y]);
        }
    }
}
sandbox.G_Blueprint.Tactics = { STANCE: "DEFAULT", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 2000, ENABLE_ASSASSINATION: true, MAX_NODES: 250 };

// 灌入 G_History 状态 (与 TC-002 一致)
sandbox.G_History.frame = 124;
sandbox.G_History.lastEnemyPos = [11, 7];
sandbox.G_History.lastEnemyDir = "right";
sandbox.G_History.lastEnemySeenFrame = 123;
sandbox.G_History.lastEnemyVisible = true;
sandbox.G_History.wasEnemyVisible = true;
sandbox.G_History.enemyInvisibleFrames = 1;
sandbox.G_History.lastUpdatedFrame = 124;
if (simState.starPos) sandbox.G_History.lastStarPos = simState.starPos.slice();
sandbox.G_History.isEnemyPosPredicted = true;

const meObj = {
    tank: { id: simState.meId, position: simState.mePos.slice(), direction: simState.meDir, crashed: false },
    stars: 3,
    bullet: null,
    skill: { type: "teleport", cooldownFrames: 40, remainingCooldownFrames: 0 },
    status: Object.assign({}, simState.meStatus),
    speak: function(text) { console.log("[Tank Speak]", text); },
    fire: function() { recordedAction = { action: "fire", target: [14,7] }; }
};

const enemyInGrass = simState.map[simState.enemyPos[0]][simState.enemyPos[1]] === 'o';
const dist = Math.abs(simState.mePos[0] - simState.enemyPos[0]) + Math.abs(simState.mePos[1] - simState.enemyPos[1]);
const isVisible = !simState.enemyStatus.cloaked && (!enemyInGrass || dist <= 1);

const enemyObj = {
    tank: isVisible ? { id: simState.enemyId, position: simState.enemyPos.slice(), direction: simState.enemyDir, crashed: false } : null,
    bullet: null,
    stars: 3,
    skill: { type: simState.enemySkillType, cooldownFrames: 35, remainingCooldownFrames: simState.enemySkillCD },
    status: Object.assign({}, simState.enemyStatus)
};

const gameObj = { map: simState.map, star: simState.starPos ? simState.starPos.slice() : null, frames: 124 };

console.log("\n================ START DEBUG TC-002 ================");
const ctx = sandbox.buildExecutionContext(meObj, enemyObj, gameObj);
console.log("tacticalAnalysis returned:", JSON.stringify(sandbox.tacticalAnalysis(ctx)));
sandbox.onIdle(meObj, enemyObj, gameObj);
console.log("================ END DEBUG TC-002 ================");
console.log("Recorded Action:", JSON.stringify(recordedAction));
