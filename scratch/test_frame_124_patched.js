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
        console.log(`\n=================== PATCHED FRAME 124 ANALYSIS ===================`);
        
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

        // 模拟 G_History 状态
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

        sandbox.G_History.frame = 124;
        sandbox.G_History.lastEnemyPos = [11, 7];
        sandbox.G_History.lastEnemyDir = "right";
        sandbox.G_History.lastEnemySeenFrame = 123;
        sandbox.G_History.lastEnemyVisible = true;
        sandbox.G_History.wasEnemyVisible = true;
        sandbox.G_History.enemyInvisibleFrames = 1;
        sandbox.G_History.lastUpdatedFrame = 124; // 防止双重递增
        sandbox.samePos = sandbox.samePos || function(a, b) { return a && b && a[0] === b[0] && a[1] === b[1]; };


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
            tank: enemyVisible ? { id: enemyId, position: enemyPos.slice(), direction: enemyDir, crashed: false } : null,
            bullet: null,
            stars: 3,
            skill: { type: enemySkillType, cooldownFrames: 35, remainingCooldownFrames: enemySkillCD },
            status: Object.assign({}, enemyStatus)
        };

        const gameObj = { map: map, star: starPos ? starPos.slice() : null, frames: 124 };

        const ctx = sandbox.buildExecutionContext(meObj, enemyObj, gameObj);
        
        // 覆盖 evalPathAmbushFire 注入修复逻辑
        sandbox.evalPathAmbushFire = function(ctx) {
            if (!ctx.enemyPos || !ctx.enemy) return null;
            var isCurrentlyInGrass = sandbox.G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
            if (!isCurrentlyInGrass) return null;

            // 修复点：当敌人不可见时，使用预测的敌人位置
            var startPos = ctx.enemyVisible ? ctx.enemyPos : ctx.predictedEnemyPos;
            var startDir = ctx.enemyDir;
            
            console.log(`[Patched evalPathAmbushFire] startPos = [${startPos}], startDir = ${startDir}`);


            var enemyPath = sandbox.getEnemyPredictedPath(startPos, startDir, ctx.starPos, ctx.map);
            if (enemyPath.length === 0) return null;

            var bestInterception = null;
            for (var i = 0; i < enemyPath.length; i++) {
                var node = enemyPath[i];
                if (ctx.starPos && sandbox.samePos(ctx.myPos, ctx.starPos)) continue;

                var d = sandbox.getDist(ctx.myPos, node.pos);
                if (d < 3 || d > 7) continue;

                var dir = sandbox.directionTo(ctx.myPos, node.pos);
                var isCoAxial = (ctx.myPos[0] === node.pos[0] || ctx.myPos[1] === node.pos[1]);
                if (!isCoAxial) continue;
                if (sandbox.isLoS(ctx.myPos, node.pos, dir, ctx.map) === false) continue;

                if (ctx.myDir !== dir) continue;

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

                // 检查当前的敌人是否与我们同轴（需要以真实当前预测位置 startPos 来判定）
                var isEnemyCoAxialWithUs = (startPos[0] === ctx.myPos[0] || startPos[1] === ctx.myPos[1]);
                var shouldFire = false;

                if (isEnemyCoAxialWithUs) {
                    var dirToTargetFromEnemy = sandbox.directionTo(startPos, node.pos);
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

                console.log(`[Patched evalPathAmbushFire] Checking Node [${node.pos}], step=${node.step}, T_bullet=${T_bullet}, T_enemy=${T_enemy}, isEnemyCoAxial=${isEnemyCoAxialWithUs}, shouldFire=${shouldFire}`);

                if (shouldFire) {
                    if (bestInterception === null || node.step < bestInterception.step) {
                        bestInterception = {
                            targetPos: node.pos,
                            T_enemy: T_enemy,
                            T_bullet: T_bullet,
                            step: node.step
                        };
                    }
                }
            }

            if (bestInterception) {
                if (!ctx.me.bullet && !ctx.meStatus.fireLocked) {
                    ctx.me.speak("通道预判: " + bestInterception.T_enemy + "帧");
                    return { action: "fire", target: bestInterception.targetPos, score: 2200, type: "ambush_fire" };
                }
            }
            return null;
        };

        const ambushFireResult = sandbox.evalPathAmbushFire(ctx);
        console.log(`Patched evalPathAmbushFire(ctx) returned: ${JSON.stringify(ambushFireResult)}`);
    }
}
