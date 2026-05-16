/**
 * AgenTank AI Agent - XDB (Strategic Assassin V12.3 - Shadow Tail)
 * 核心优化：
 * 1. 影子终点预测 (Shadow Tail)：预测隐身结束时对手可能抵达的坐标。
 * 2. 动态衰减：比分领先时取消影子衰减，强制保持高压规避。
 * 3. 现身防守：在预测隐身结束前 1 帧执行“防御性侧移”。
 */

var G_Blueprint = {
    initialized: false,
    enemyProfile: null,
    mapVision: null,
    Tactics: {
        STANCE: "DEFAULT",
        DANGER_RADIUS: 4,
        ASTAR_UNSAFE_PENALTY: 1000,
        ENABLE_ASSASSINATION: true,
        MAX_NODES: 350
    }
};

var G_History = {
    lastEnemyPos: null, lastEnemyDir: "up", lastEnemySeenFrame: -99,
    cloakFramesLeft: 0, postTeleportFrames: 0, frame: 0,
    defenseLockTicks: 0, lastDefenseTarget: null, 
    path: [], pathTarget: null, stuckTurnCount: 0, lastPos: null
};

var CONFIG = { KILL_PRIO: 10000, STAR_PRIO: 800, TURN_COST: 0.8 };

function onIdle(me, enemy, game) {
    try {
        G_History.frame = game.frames || 0;
        if (G_History.postTeleportFrames > 0) G_History.postTeleportFrames--;
        if (G_History.cloakFramesLeft > 0) G_History.cloakFramesLeft--;
        if (!G_Blueprint.initialized) strategicInit(enemy, game.map);

        var ctx = buildExecutionContext(me, enemy, game);
        if (ctx.meStatus.stunned || ctx.meStatus.frozen) return;

        if (ctx.enemyVisible && !ctx.enemyShielded && canShoot(ctx.myPos, ctx.enemyPos, ctx.map)) {
            var dir = directionTo(ctx.myPos, ctx.enemyPos);
            if (ctx.myDir === dir && !me.bullet && !ctx.meStatus.fireLocked) {
                me.fire(); return;
            }
        }

        var defenseAction = tacticalDefense(me, ctx);
        if (defenseAction) { executeAction(me, defenseAction, ctx); return; }

        var bestAction = tacticalAnalysis(ctx);
        executeAction(me, bestAction, ctx);
    } catch (e) { print("Error: " + e.message); }
}

function strategicInit(enemy, map) {
    G_Blueprint.mapVision = analyzeMap(map);
    if (enemy) {
        var sType = enemy.skill ? enemy.skill.type : "none";
        if (sType === "freeze" || sType === "stun") {
            G_Blueprint.Tactics = {
                STANCE: "ANTI_CONTROL", DANGER_RADIUS: 5, ASTAR_UNSAFE_PENALTY: 1000,
                ENABLE_ASSASSINATION: false, MAX_NODES: 600
            };
        } else if (sType === "cloak") {
            G_Blueprint.Tactics = {
                STANCE: "ANTI_CLOAK", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 1500,
                ENABLE_ASSASSINATION: true, MAX_NODES: 500, JITTER: true
            };
        } else {
            G_Blueprint.Tactics = {
                STANCE: "DEFAULT", DANGER_RADIUS: 3, ASTAR_UNSAFE_PENALTY: 800,
                ENABLE_ASSASSINATION: true, MAX_NODES: 400
            };
        }
    }
    G_Blueprint.initialized = true;
}

function analyzeMap(map) {
    var w = map.length, h = map[0].length, v = { width: w, height: h, cover: {}, grass: {} };
    for (var x = 0; x < w; x++) {
        for (var y = 0; y < h; y++) {
            var t = map[x][y];
            if (t === "x" || t === "m") v.cover[x + "," + y] = true;
            if (t === "o") v.grass[x + "," + y] = true;
        }
    }
    return v;
}

function buildExecutionContext(me, enemy, game) {
    var eTank = enemy ? enemy.tank : null;
    var visible = !!eTank;
    var ePos = G_History.lastEnemyPos;
    var eDir = G_History.lastEnemyDir;
    
    if (visible) {
        G_History.lastEnemyPos = eTank.position; G_History.lastEnemyDir = eTank.direction; G_History.lastEnemySeenFrame = G_History.frame;
        if (enemy.status && enemy.status.cloaked) G_History.cloakFramesLeft = 8;
        ePos = eTank.position; eDir = eTank.direction;
    } else if (G_Blueprint.Tactics.STANCE === "ANTI_CLOAK" && G_History.cloakFramesLeft > 0) {
        // 预测影子当前位置
        var np = addPos(G_History.lastEnemyPos, delta(G_History.lastEnemyDir));
        if (isPassable(np, game.map)) G_History.lastEnemyPos = np;
        ePos = G_History.lastEnemyPos;
    }

    return {
        me: me, myPos: me.tank.position, myDir: me.tank.direction, meStars: me.stars, meStatus: me.status || {},
        enemy: enemy, enemyPos: ePos, enemyDir: eDir, enemyVisible: visible,
        enemyCloaked: G_History.cloakFramesLeft > 0,
        invisibleTicks: G_History.frame - G_History.lastEnemySeenFrame,
        enemySkillReady: enemy && enemy.skill && enemy.skill.remainingCooldownFrames === 0,
        enemyFireLocked: enemy && enemy.status && enemy.status.fireLocked,
        enemyShielded: enemy && enemy.status && enemy.status.shielded,
        enemyBullet: enemy ? enemy.bullet : null, starPos: game.star, map: game.map,
        canTeleport: me.skill && me.skill.remainingCooldownFrames === 0
    };
}

function tacticalAnalysis(ctx) {
    var candidates = [];
    if (ctx.canTeleport) {
        if (G_Blueprint.Tactics.ENABLE_ASSASSINATION) candidates.push(evalAssassination(ctx));
        if (G_Blueprint.Tactics.STANCE === "ANTI_CLOAK") candidates.push(evalPanicTeleport(ctx));
    }
    candidates.push(evalShooting(ctx));
    candidates.push(evalStarCollection(ctx));
    candidates.push(evalSurvival(ctx));
    candidates.sort(function(a, b) { return (b?b.score:0) - (a?a.score:0); });
    return candidates[0];
}

function evalPanicTeleport(ctx) {
    if (ctx.enemyCloaked && !isSafeForAntiCloak(ctx.myPos, ctx)) {
        var d = getDist(ctx.myPos, ctx.enemyPos);
        if (d < 8) {
            var esc = findSafeGrassSpot(ctx) || findSafeQuadrantSpot(ctx);
            if (esc) return { action: "teleport", target: esc, score: 99999 };
        }
    }
    return null;
}

function evalAssassination(ctx) {
    if (!ctx.enemyPos || (ctx.enemy && ctx.enemy.status && ctx.enemy.status.shielded)) return null;
    if (ctx.enemyCloaked && !ctx.enemyFireLocked) return null;
    if (ctx.enemyFireLocked || (ctx.meStars < ctx.enemyStars && !ctx.enemySkillReady)) {
        var spot = findAssassinSpot(ctx);
        if (spot && isSafe(spot, ctx, true)) return { action: "teleport", target: spot, score: CONFIG.KILL_PRIO + 100 };
    }
    return null;
}

function evalShooting(ctx) {
    if (!ctx.enemyPos || !ctx.enemyVisible) return null;
    if (canShoot(ctx.myPos, ctx.enemyPos, ctx.map)) {
        return { action: "turn", target: ctx.enemyPos, score: CONFIG.KILL_PRIO - 100 };
    }
    return null;
}

function evalStarCollection(ctx) {
    if (!ctx.starPos) return null;
    var dist = getDist(ctx.myPos, ctx.starPos);
    var score = CONFIG.STAR_PRIO - dist;
    if (G_History.frame < 80) score += 600;
    if (ctx.meStars <= ctx.enemyStars) score += 400;
    if (ctx.canTeleport && dist > 8 && isSafe(ctx.starPos, ctx, true)) {
        return { action: "teleport", target: ctx.starPos, score: CONFIG.STAR_PRIO + 1000 };
    }
    return { action: "move", target: ctx.starPos, score: score };
}

function evalSurvival(ctx) {
    if (G_Blueprint.Tactics.STANCE === "ANTI_CLOAK" || G_Blueprint.Tactics.STANCE === "ANTI_CONTROL") {
        var grass = findNearestGrass(ctx.myPos);
        if (grass) return { action: "move", target: grass, score: 200 - getDist(ctx.myPos, grass) * 10 };
    }
    return { action: "move", target: [9, 7], score: 0 };
}

function tacticalDefense(me, ctx) {
    if (G_History.defenseLockTicks > 0 && G_History.lastDefenseTarget) {
        G_History.defenseLockTicks--;
        if (isSafe(G_History.lastDefenseTarget, ctx, true)) return { action: "move", target: G_History.lastDefenseTarget, score: 30000 };
    }
    if (ctx.enemyBullet) {
        var fH = getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map);
        if (fH <= 4) {
            var dodge = findBestDodge(ctx, fH);
            if (ctx.canTeleport && (!dodge || fH <= 2)) {
                var jmp = findSafeGrassSpot(ctx) || findEscapeSpot(ctx);
                if (jmp) return { action: "teleport", target: jmp, score: 99999 };
            }
            if (dodge) { G_History.defenseLockTicks = 2; G_History.lastDefenseTarget = dodge; return { action: "move", target: dodge, score: 99999 }; }
        }
    }
    if (G_Blueprint.Tactics.STANCE === "ANTI_CLOAK" && !isSafeForAntiCloak(ctx.myPos, ctx)) {
        var move = findOffAxisMove(ctx);
        if (move) return move;
    }
    return null;
}

function isSafe(pos, ctx, strict) {
    if (getFramesToHit(pos, ctx.enemyBullet, ctx.map) <= 2) return false;
    if (ctx.enemyPos && ctx.enemyVisible) {
        if (isLoS(ctx.enemyPos, pos, ctx.enemyDir, ctx.map)) return false;
        var d = getDist(pos, ctx.enemyPos);
        if (strict && ctx.enemySkillReady && d <= G_Blueprint.Tactics.DANGER_RADIUS) return false;
        if (d < 2) return false;
    }
    return true;
}

function isSafeForAntiCloak(pos, ctx) {
    if (!ctx.enemyPos) return true;
    var d = getDist(pos, ctx.enemyPos);
    var onAxis = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
    
    // 动态衰减修正：比分领先时保持高警觉
    var decayStartFrame = (ctx.meStars > ctx.enemyStars) ? 99 : 5;
    var maxEvasionDist = ctx.invisibleTicks > decayStartFrame ? 6 : 13;
    
    var corridorWidth = d < 7 ? 1 : 0;
    var inCorridor = (Math.abs(pos[0] - ctx.enemyPos[0]) <= corridorWidth || Math.abs(pos[1] - ctx.enemyPos[1]) <= corridorWidth);
    
    if (inCorridor && d <= maxEvasionDist && canShoot(ctx.enemyPos, pos, ctx.map)) return false;
    if (ctx.enemyCloaked && d <= 5) return false;
    return true;
}

function aStar(start, goal, ctx) {
    var open = [{ pos: start, g: 0, h: getDist(start, goal), path: [], dir: ctx.myDir }], closed = {}, nodes = 0;
    var t = G_Blueprint.Tactics;
    while (open.length > 0 && nodes < t.MAX_NODES) {
        open.sort(function(a, b) { return (a.g + a.h) - (b.g + b.h); });
        var curr = open.shift();
        if (samePos(curr.pos, goal)) return curr.path;
        if (closed[key(curr.pos)] && closed[key(curr.pos)] <= curr.g) continue;
        closed[key(curr.pos)] = curr.g; nodes++;
        var dirs = ["up", "right", "down", "left"];
        for (var i = 0; i < dirs.length; i++) {
            var d = dirs[i], next = addPos(curr.pos, delta(d));
            if (isPassable(next, ctx.map)) {
                var cost = 1 + (curr.dir === d ? 0 : CONFIG.TURN_COST);
                if (!isSafe(next, ctx, true)) cost += t.ASTAR_UNSAFE_PENALTY;
                if (t.STANCE === "ANTI_CLOAK" && !isSafeForAntiCloak(next, ctx)) cost += 3000;
                if (t.JITTER && ctx.enemyCloaked && curr.dir && curr.dir !== d) cost -= 0.1;
                var np = curr.path.slice(); np.push(next);
                open.push({ pos: next, g: curr.g + cost, h: getDist(next, goal), path: np, dir: d });
            }
        }
    }
    return null;
}

function executeAction(me, act, ctx) {
    if (!act) return;
    if (act.action === "fire") { if (!me.bullet) me.fire(); }
    else if (act.action === "turn") { me.turn(directionTo(ctx.myPos, act.target)); }
    else if (act.action === "teleport") { me.teleport(act.target[0], act.target[1]); G_History.postTeleportFrames = 8; }
    else if (act.action === "move") {
        if (G_History.lastPos && samePos(ctx.myPos, G_History.lastPos)) G_History.stuckTurnCount++; else G_History.stuckTurnCount = 0;
        G_History.lastPos = ctx.myPos.slice();
        if (G_History.stuckTurnCount >= 4) {
            G_History.stuckTurnCount = 0;
            if (ctx.canTeleport && ctx.starPos) { me.teleport(ctx.starPos[0], ctx.starPos[1]); return; }
        }
        var next = getNextStep(ctx.myPos, act.target, ctx);
        if (next) {
            var d = directionTo(ctx.myPos, next);
            if (ctx.myDir === d) { if (ctx.meStatus.boosted) me.go(2); else me.go(); } else me.turn(d);
        }
    }
}

function getNextStep(start, goal, ctx) {
    if (samePos(start, goal)) return null;
    var path = aStar(start, goal, ctx);
    if (path && path.length > 0) return path[0];
    var dirs = ["up", "right", "down", "left"], best = null, maxS = -9999999;
    for (var i = 0; i < dirs.length; i++) {
        var n = addPos(start, delta(dirs[i]));
        if (isPassable(n, ctx.map)) {
            var s = -getDist(n, goal);
            if (!isSafe(n, ctx, true)) s -= 50000;
            if (s > maxS) { maxS = s; best = n; }
        }
    }
    return best;
}

function findSafeGrassSpot(ctx) {
    var grass = [];
    for (var k in G_Blueprint.mapVision.grass) {
        var p = k.split(",").map(Number);
        if (isSafe(p, ctx, true) && getDist(p, ctx.enemyPos) > 10) grass.push(p);
    }
    if (grass.length === 0) return null;
    grass.sort(function(a, b) { return getDist(b, ctx.enemyPos) - getDist(a, ctx.enemyPos); });
    return grass[0];
}

function findNearestGrass(pos) {
    var best = null, minDist = 999;
    for (var k in G_Blueprint.mapVision.grass) {
        var p = k.split(",").map(Number);
        var d = getDist(pos, p); if (d < minDist) { minDist = d; best = p; }
    }
    return best;
}

function isLoS(s, e, dir, map) {
    if (!s || !e || (s[0] !== e[0] && s[1] !== e[1])) return false;
    if (directionTo(s, e) !== dir) return false;
    var st = delta(dir), p = addPos(s, st);
    while (!samePos(p, e)) { if (G_Blueprint.mapVision.cover[key(p)]) return false; p = addPos(p, st); }
    return true;
}

function canShoot(a, b, map) {
    if (!a || !b || samePos(a, b) || (a[0] !== b[0] && a[1] !== b[1])) return false;
    var d = directionTo(a, b), st = delta(d), p = addPos(a, st);
    while (!samePos(p, b)) { if (G_Blueprint.mapVision.cover[key(p)]) return false; p = addPos(p, st); }
    return true;
}

function findOffAxisMove(ctx) {
    var neighbors = ["up", "right", "down", "left"], best = null, maxS = -1;
    for (var i = 0; i < neighbors.length; i++) {
        var n = addPos(ctx.myPos, delta(neighbors[i]));
        if (isPassable(n, ctx.map) && isSafe(n, ctx, true)) {
            var s = getDist(n, ctx.enemyPos); if (s > maxS) { maxS = s; best = n; }
        }
    }
    return best ? { action: "move", target: best, score: 25000 } : null;
}

function findAssassinSpot(ctx) {
    var e = ctx.enemyPos, offsets = [[-5,0], [5,0], [0,-5], [0,5]];
    for (var i = 0; i < offsets.length; i++) {
        var p = addPos(e, offsets[i]); if (isPassable(p, ctx.map) && canShoot(p, e, ctx.map)) return p;
    }
    return null;
}

function findSafeQuadrantSpot(ctx) {
    var e = ctx.enemyPos, q = [ctx.myPos[0] < e[0] ? 2 : 17, ctx.myPos[1] < e[1] ? 2 : 12];
    if (isPassable(q, ctx.map) && isSafe(q, ctx, true)) return q;
    return findEscapeSpot(ctx);
}

function findEscapeSpot(ctx) {
    var offs = [[5,0], [-5,0], [0,5], [0,-5], [4,4], [-4,-4]];
    for (var i = 0; i < offs.length; i++) {
        var p = addPos(ctx.myPos, offs[i]); if (isPassable(p, ctx.map) && isSafe(p, ctx, false)) return p;
    }
    return null;
}

function findBestDodge(ctx, hitLimit) {
    var b = ctx.enemyBullet; if (!b) return null;
    var dirs = ["up", "right", "down", "left"], best = null, maxH = -1;
    for (var i = 0; i < dirs.length; i++) {
        var n = addPos(ctx.myPos, delta(dirs[i]));
        if (isPassable(n, ctx.map)) {
            var h = getFramesToHit(n, b, ctx.map); if (h > maxH && h > hitLimit) { maxH = h; best = n; }
        }
    }
    return best;
}

function getFramesToHit(pos, bullet, map) {
    if (!bullet) return Infinity;
    if (isLoS(bullet.position, pos, bullet.direction, map)) return Math.ceil(getDist(pos, bullet.position) / 2);
    return Infinity;
}

function getDist(a, b) { if(!a || !b) return 999; return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
function samePos(a, b) { return a && b && a[0] === b[0] && a[1] === b[1]; }
function addPos(p, d) { return [p[0] + d[0], p[1] + d[1]]; }
function key(p) { return p[0] + "," + p[1]; }
function delta(d) { return { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }[d] || [0,0]; }
function directionTo(a, b) { if (b[0] > a[0]) return "right"; if (b[0] < a[0]) return "left"; if (b[1] > a[1]) return "down"; return "up"; }
function isPassable(p, map) { if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return false; var t = map[p[0]][p[1]]; return t !== "x" && t !== "m"; }
