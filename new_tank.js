/**
 * AgenTank AI Agent - XDB (Strategic Assassin V12.30 - Protocol Evolution)
 * 核心目标：结合 V12.24 的预瞄逻辑，解决 V12.7 的子弹躲避优先级问题，强化轴线规避。
 */

var G_Blueprint = {
    initialized: false,
    enemySeen: false,
    enemyProfile: null,
    mapVision: null,
    Tactics: {
        STANCE: "DEFAULT",
        DANGER_RADIUS: 4,
        ASTAR_UNSAFE_PENALTY: 2000,
        ENABLE_ASSASSINATION: true,
        MAX_NODES: 250
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
        if (!G_Blueprint.initialized || (enemy && !G_Blueprint.enemySeen)) strategicInit(enemy, game.map);

        var ctx = buildExecutionContext(me, enemy, game);
        if (ctx.meStatus.stunned || ctx.meStatus.frozen) return;

        // 1. 绝杀与 Mound 压制
        if (ctx.enemyVisible && !ctx.enemyShielded) {
            var cs = canShoot(ctx.myPos, ctx.enemyPos, ctx.map);
            if (cs === true || (cs === "mound" && getDist(ctx.myPos, ctx.enemyPos) <= 7)) {
                var dir = directionTo(ctx.myPos, ctx.enemyPos);
                if (ctx.myDir === dir && !me.bullet && !ctx.meStatus.fireLocked) {
                    me.fire(); return;
                }
            }
        }

        // 2. 紧急防御 (模块化路由)
        var defenseAction = tacticalDefense(me, ctx);
        if (defenseAction) { executeAction(me, defenseAction, ctx); return; }

        // 3. 战术评估
        var bestAction = tacticalAnalysis(ctx);
        executeAction(me, bestAction, ctx);

    } catch (e) { print("Error: " + e.message); }
}

function strategicInit(enemy, map) {
    G_Blueprint.mapVision = analyzeMap(map);
    if (enemy) {
        G_Blueprint.enemySeen = true;
        var sType = (enemy.skill && enemy.skill.type) ? enemy.skill.type : "none";
        if (sType === "freeze" || sType === "stun") {
            G_Blueprint.Tactics = {
                STANCE: "ANTI_CONTROL", DANGER_RADIUS: 8, ASTAR_UNSAFE_PENALTY: 3000,
                ENABLE_ASSASSINATION: false, MAX_NODES: 200
            };
        } else if (sType === "cloak") {
            G_Blueprint.Tactics = {
                STANCE: "ANTI_CLOAK", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 1500,
                ENABLE_ASSASSINATION: true, MAX_NODES: 200, JITTER: true
            };
        } else {
            G_Blueprint.Tactics = {
                STANCE: "DEFAULT", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 2000,
                ENABLE_ASSASSINATION: true, MAX_NODES: 250
            };
        }
    }
    G_Blueprint.initialized = true;
}

function analyzeMap(map) {
    var w = map.length, h = map[0].length, v = { width: w, height: h, cover: {}, grass: {} };
    for (var x = 0; x < w; x++) {
        for (var y = 0; y < h; y++) {
            var tile = map[x][y];
            if (tile === "x") v.cover[x + "," + y] = true;
            if (tile === "o") v.grass[x + "," + y] = true;
        }
    }
    return v;
}

function buildExecutionContext(me, enemy, game) {
    var eTank = enemy ? enemy.tank : null;
    var visible = !!eTank;

    if (enemy && enemy.status && enemy.status.cloaked) {
        G_History.cloakFramesLeft = 8;
    }

    if (visible) {
        G_History.lastEnemyPos = eTank.position; G_History.lastEnemyDir = eTank.direction; G_History.lastEnemySeenFrame = G_History.frame;
    }
    return {
        me: me, myPos: me.tank.position, myDir: me.tank.direction, meStars: me.stars, meStatus: me.status || {},
        enemy: enemy, enemyPos: G_History.lastEnemyPos, enemyDir: G_History.lastEnemyDir, enemyVisible: visible,
        enemyCloaked: G_History.cloakFramesLeft > 0,
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
    candidates.push(evalPreAim(ctx));
    candidates.push(evalStarCollection(ctx));
    candidates.push(evalGrassAmbushAndSurvival(ctx));
    candidates.sort(function (a, b) { return (b ? b.score : 0) - (a ? a.score : 0); });
    return candidates[0];
}

function evalPanicTeleport(ctx) {
    if (ctx.enemyCloaked && !isSafeForAntiCloak(ctx.myPos, ctx)) {
        var esc = findSafeGrassSpot(ctx) || findSafeQuadrantSpot(ctx);
        if (esc) return { action: "teleport", target: esc, score: 99999 };
    }
    return null;
}

function evalAssassination(ctx) {
    if (!ctx.enemyPos || (ctx.enemy && ctx.enemy.status && ctx.enemy.status.shielded)) return null;
    if (ctx.enemyCloaked && !ctx.enemyFireLocked) return null;
    if (ctx.enemyFireLocked || (ctx.meStars < ctx.enemyStars && !ctx.enemySkillReady)) {
        var spot = findAssassinSpot(ctx);
        if (spot && isSafeForStarTeleport(spot, ctx)) return { action: "teleport", target: spot, score: CONFIG.KILL_PRIO + 100 };
    }
    return null;
}

function evalShooting(ctx) {
    if (!ctx.enemyPos || !ctx.enemyVisible) return null;
    var cs = canShoot(ctx.myPos, ctx.enemyPos, ctx.map);
    if (cs === true) {
        if (ctx.enemyShielded) return null;
        var dir = directionTo(ctx.myPos, ctx.enemyPos);
        if (ctx.myDir !== dir) {
            var onEnemyAxis = (ctx.myPos[0] === ctx.enemyPos[0] || ctx.myPos[1] === ctx.enemyPos[1]);
            if (onEnemyAxis && isLoS(ctx.enemyPos, ctx.myPos, ctx.enemyDir, ctx.map) && !ctx.enemyFireLocked) return null;
        }
        return { action: "turn", target: ctx.enemyPos, score: CONFIG.KILL_PRIO - 100 };
    }
    return null;
}

function evalPreAim(ctx) {
    if (!ctx.enemyPos || !ctx.enemyVisible || !ctx.enemyDir) return null;

    var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
    var recentlyTeleported = G_History.postTeleportFrames > 0;

    if (isCurrentlyInGrass || recentlyTeleported) {
        var preAimDir = findPreAimDir(ctx.myPos, ctx.enemyPos, ctx.enemyDir, ctx.map);
        if (preAimDir && ctx.myDir !== preAimDir) {
            return { action: "turn", target: addPos(ctx.myPos, delta(preAimDir)), score: CONFIG.KILL_PRIO - 150 };
        }
    }
    return null;
}

function evalStarCollection(ctx) {
    if (!ctx.starPos) return null;
    var dist = getDist(ctx.myPos, ctx.starPos);

    var score = CONFIG.STAR_PRIO - dist;
    if (G_History.frame < 80) score += 600;
    if (ctx.enemy && ctx.meStars <= ctx.enemy.stars) score += 400;

    var safeForTeleport = isSafeForStarTeleport(ctx.starPos, ctx);
    if (ctx.canTeleport && dist > 7 && safeForTeleport) {
        return { action: "teleport", target: ctx.starPos, score: CONFIG.STAR_PRIO + 1000 };
    }

    var safeForWalking = isSafeForStarWalking(ctx.starPos, ctx);
    if (!safeForWalking) score -= 1200;
    return { action: "move", target: ctx.starPos, score: score };
}

function evalGrassAmbushAndSurvival(ctx) {
    var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
    var grass = findNearestGrass(ctx.myPos);

    if (grass) {
        var starUnsafe = ctx.starPos && !isSafeForStarWalking(ctx.starPos, ctx);
        var score = 300;

        // Priority adjustment for bullet danger
        //if (ctx.enemyBullet && getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map) < 10) score -= 1000;

        if (isCurrentlyInGrass && (!ctx.starPos || starUnsafe)) {
            if (ctx.enemyVisible && canShoot(ctx.myPos, ctx.enemyPos, ctx.map) === true) {
                var d = directionTo(ctx.myPos, ctx.enemyPos);
                if (ctx.myDir === d) return { action: "move", target: ctx.myPos, score: score + 100 };
                if (ctx.enemyDir !== reverseDir(d)) return { action: "turn", target: ctx.enemyPos, score: score + 50 };
            }
            return { action: "move", target: ctx.myPos, score: score };
        }

        score = 250 - getDist(ctx.myPos, grass) * 10;
        if (!ctx.starPos || starUnsafe) score += 550;
        //if (ctx.enemyBullet && getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map) < 10) score -= 1000;

        return { action: "move", target: grass, score: score };
    }

    // 草丛开局
    var nearestGrass = null, minDist = 999;
    for (var k in G_Blueprint.mapVision.grass) {
        var p = k.split(",").map(Number);
        var d = getDist(ctx.myPos, p); if (d < minDist) { minDist = d; nearestGrass = p; }
    }
    return { action: "move", target: nearestGrass || [9, 7], score: 0 };
}

function tacticalDefense(me, ctx) {
    if (ctx.enemyBullet) {
        var fH = getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map);
        if (fH <= 5) {
            var dodge = findBestDodge(ctx, fH);
            if (ctx.canTeleport && (fH <= 2 || !dodge)) {
                var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx);
                if (esc) return { action: "teleport", target: esc, score: 99999 };
            }
            if (dodge) { G_History.defenseLockTicks = 2; G_History.lastDefenseTarget = dodge; return { action: "move", target: dodge, score: 99999 }; }
        }
    }

    if (G_History.defenseLockTicks > 0 && G_History.lastDefenseTarget) {
        G_History.defenseLockTicks--;
        if (isSafe(G_History.lastDefenseTarget, ctx, true)) return { action: "move", target: G_History.lastDefenseTarget, score: 30000 };
    }

    if (ctx.enemyPos && ctx.enemyVisible && !ctx.enemyFireLocked) {
        var d = getDist(ctx.myPos, ctx.enemyPos);
        var onAxis = (ctx.myPos[0] === ctx.enemyPos[0] || ctx.myPos[1] === ctx.enemyPos[1]);
        if (onAxis && d <= 8 && canShoot(ctx.enemyPos, ctx.myPos, ctx.map) === true) {
            if (isLoS(ctx.enemyPos, ctx.myPos, ctx.enemyDir, ctx.map)) {
                var escape = findOffAxisMove(ctx);
                if (escape) { escape.score = 25000; return escape; }
                if (ctx.canTeleport) {
                    var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx);
                    if (esc) return { action: "teleport", target: esc, score: 99999 };
                }
            }
        }
    }

    if (G_Blueprint.Tactics.STANCE === "ANTI_CLOAK" && !isSafeForAntiCloak(ctx.myPos, ctx)) {
        var move = findOffAxisMove(ctx);
        if (move) return move;
    }
    return null;
}

// --- [4. 引擎核心] ---

function isSafe(pos, ctx, strict) {
    if (!pos) return false;
    var fH = getFramesToHit(pos, ctx.enemyBullet, ctx.map);
    if (fH <= (strict ? 4 : 2)) return false;

    if (ctx.enemyPos) {
        var d = getDist(pos, ctx.enemyPos);
        if (ctx.enemyVisible) {
            // ✅ 草丛格豁免 LoS 检查——进去就隐身，不算危险
            var isGrass = G_Blueprint.mapVision.grass[pos[0] + "," + pos[1]];
            if (!isGrass && isLoS(ctx.enemyPos, pos, ctx.enemyDir, ctx.map)) return false;
            if (strict && ctx.enemySkillReady && d <= G_Blueprint.Tactics.DANGER_RADIUS) return false;
            if (d < 2) return false;
        } else {
            // 针对近距离隐身敌人的同轴预判防御
            var enemySeenRecently = (G_History.frame - G_History.lastEnemySeenFrame < 15);
            if (enemySeenRecently && d <= 5) {
                var inGrass = G_Blueprint.mapVision.grass[pos[0] + "," + pos[1]];
                if (!inGrass && (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1])) {
                    if (canShoot(ctx.enemyPos, pos, ctx.map) !== false) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
}

function isSafeForStarTeleport(pos, ctx) {
    if (!isSafe(pos, ctx, true)) return false;
    if (ctx.enemyPos) {
        var d = getDist(pos, ctx.enemyPos);
        if (d <= 2) return false;
        if (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]) {
            if (isLoS(ctx.enemyPos, pos, ctx.enemyDir, ctx.map)) {
                if (d <= 5 && !ctx.enemyFireLocked) return false;
            }
        }
    }
    return true;
}

function isSafeForStarWalking(pos, ctx) {
    if (!ctx.enemyPos) return true;

    var myDist = getDist(ctx.myPos, pos);
    var enemyDist = getDist(ctx.enemyPos, pos);

    // Calculate enemy bullet arrival time at the star
    var T_bullet = Infinity;
    var onAxis = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
    if (onAxis && canShoot(ctx.enemyPos, pos, ctx.map) === true) {
        if (isLoS(ctx.enemyPos, pos, ctx.enemyDir, ctx.map)) {
            T_bullet = Math.ceil(enemyDist / 2);
        } else {
            T_bullet = 1 + Math.ceil(enemyDist / 2); // 1 frame to turn, then shoot
        }
    }

    // Calculate our arrival time at the star
    var T_me = myDist;
    if (directionTo(ctx.myPos, pos) !== ctx.myDir) {
        T_me += 1;
    }

    // If we can reach it before their bullet can hit it, it's safe
    var requiredBuffer = ctx.canTeleport ? 0 : 1;
    if (T_me + requiredBuffer < T_bullet) {
        if (enemyDist <= 1) return false;
        var bulletFH = getFramesToHit(pos, ctx.enemyBullet, ctx.map);
        if (bulletFH <= T_me) return false;
        return true;
    }

    return isSafe(pos, ctx, true);
}

function isSafeForAntiCloak(pos, ctx) {
    if (!ctx.enemyPos) return true;
    var d = getDist(pos, ctx.enemyPos);
    var onAxis = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
    if (onAxis && d <= 12 && canShoot(ctx.enemyPos, pos, ctx.map) === true) return false;
    if (ctx.enemyCloaked && d <= 6) return false;
    return true;
}

function aStar(start, goal, ctx) {
    var open = [{ pos: start, g: 0, h: getDist(start, goal), path: [], dir: ctx.myDir }], closed = {}, nodes = 0;
    var t = G_Blueprint.Tactics;
    while (open.length > 0 && nodes < t.MAX_NODES) {
        open.sort(function (a, b) { return (a.g + a.h) - (b.g + b.h); });
        var curr = open.shift();
        if (samePos(curr.pos, goal)) return curr.path;
        if (closed[key(curr.pos)] && closed[key(curr.pos)] <= curr.g) continue;
        closed[key(curr.pos)] = curr.g; nodes++;
        var dirs = ["up", "right", "down", "left"];
        for (var i = 0; i < dirs.length; i++) {
            var d = dirs[i], next = addPos(curr.pos, delta(d));
            var tile = getTile(next, ctx.map);
            if (tile && tile !== "x") {
                var cost = 1 + (curr.dir === d ? 0 : CONFIG.TURN_COST);
                if (tile === "m") cost += 200;
                if (!isSafe(next, ctx, true)) cost += t.ASTAR_UNSAFE_PENALTY;

                // Smart Bullet Axis Penalty
                if (ctx.enemyBullet && isLoS(ctx.enemyBullet.position, next, ctx.enemyBullet.direction, ctx.map)) {
                    var dOld = getDist(curr.pos, ctx.enemyBullet.position);
                    var dNew = getDist(next, ctx.enemyBullet.position);
                    if (dNew < dOld) cost += 5000; // Penalize moving towards it
                    else cost += 1000; // Penalize staying on axis
                }

                if (t.STANCE === "ANTI_CLOAK" && !isSafeForAntiCloak(next, ctx)) cost += 2000;
                var np = curr.path.slice(); np.push(next);
                open.push({ pos: next, g: curr.g + cost, h: getDist(next, goal), path: np, dir: d });
            }
        }
    }
    return null;
}

// --- [5. 工具库] ---

function executeAction(me, act, ctx) {
    if (!act) return;
    if (act.action === "fire") {
        var d = directionTo(ctx.myPos, act.target);
        if (ctx.myDir === d) { if (!me.bullet && !ctx.meStatus.fireLocked) me.fire(); } else me.turn(d);
    }
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
            var tile = getTile(next, ctx.map);
            var d = directionTo(ctx.myPos, next);
            if (tile === "m") {
                if (ctx.myDir === d) { if (!me.bullet && !ctx.meStatus.fireLocked) me.fire(); } else me.turn(d);
            } else {
                if (ctx.myDir === d) { if (ctx.meStatus.boosted) me.go(2); else me.go(); } else me.turn(d);
            }
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
        var t = getTile(n, ctx.map);
        if (t && t !== "x") {
            var s = -getDist(n, goal);
            if (t === "m") s -= 200;
            if (!isSafe(n, ctx, true)) s -= 50000;
            if (s > maxS) { maxS = s; best = n; }
        }
    }
    return best;
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

function findSafeGrassSpot(ctx) {
    var grass = [];
    for (var k in G_Blueprint.mapVision.grass) {
        var p = k.split(",").map(Number);
        if (isSafe(p, ctx, true) && getDist(p, ctx.enemyPos) > 10) grass.push(p);
    }
    if (grass.length === 0) return null;
    grass.sort(function (a, b) { return getDist(b, ctx.enemyPos) - getDist(a, ctx.enemyPos); });
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
    if (samePos(s, e)) return true;
    if (directionTo(s, e) !== dir) return false;
    var st = delta(dir);
    if (st[0] === 0 && st[1] === 0) return false;
    var p = addPos(s, st), safety = 0;
    while (!samePos(p, e) && safety < 30) {
        var t = getTile(p, map);
        if (t === "x" || t === "m") return false;
        p = addPos(p, st); safety++;
    }
    return samePos(p, e);
}

function canShoot(a, b, map) {
    if (!a || !b || samePos(a, b) || (a[0] !== b[0] && a[1] !== b[1])) return false;
    var d = directionTo(a, b), st = delta(d);
    if (st[0] === 0 && st[1] === 0) return false;
    var p = addPos(a, st), blockedByMound = false, safety = 0;
    while (!samePos(p, b) && safety < 30) {
        var t = getTile(p, map);
        if (t === "x") return false;
        if (t === "m") blockedByMound = true;
        p = addPos(p, st); safety++;
    }
    return samePos(p, b) ? (blockedByMound ? "mound" : true) : false;
}

function findAssassinSpot(ctx) {
    var e = ctx.enemyPos, offsets = [[-5, 0], [5, 0], [0, -5], [0, 5]];

    // 1. 预测暗杀点 (结合预瞄逻辑)
    if (ctx.enemyDir) {
        var ed = delta(ctx.enemyDir);
        var predE = addPos(e, [ed[0] * 2, ed[1] * 2]); // 预测 2 步
        if (isPassable(predE, ctx.map) && isPassable(addPos(e, ed), ctx.map)) {
            for (var i = 0; i < offsets.length; i++) {
                var p = addPos(predE, offsets[i]);
                if (isPassable(p, ctx.map) && canShoot(p, predE, ctx.map) === true) {
                    if (isSafe(p, ctx, true)) return p;
                }
            }
        }
    }

    // 2. 兜底当前点
    for (var i = 0; i < offsets.length; i++) {
        var p = addPos(e, offsets[i]); if (isPassable(p, ctx.map) && canShoot(p, e, ctx.map) === true) return p;
    }
    return null;
}

function findPreAimDir(myPos, enemyPos, enemyDir, map) {
    if (!myPos || !enemyPos || !enemyDir) return null;
    var d = delta(enemyDir);
    if (d[0] === 0 && d[1] === 0) return null;

    var p = enemyPos.slice();
    for (var i = 1; i <= 6; i++) {
        p = addPos(p, d);
        if (!isPassable(p, map)) break;

        if (p[0] === myPos[0] || p[1] === myPos[1]) {
            if (canShoot(myPos, p, map) === true) {
                return directionTo(myPos, p);
            }
        }
    }
    return null;
}

function findSafeQuadrantSpot(ctx) {
    var e = ctx.enemyPos, q = [ctx.myPos[0] < e[0] ? 2 : 17, ctx.myPos[1] < e[1] ? 2 : 12];
    if (isPassable(q, ctx.map) && isSafe(q, ctx, true)) return q;
    return findEscapeSpot(ctx);
}

function findEscapeSpot(ctx) {
    var offs = [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 4], [-4, -4]];
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

function getDist(a, b) { if (!a || !b) return 999; return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
function samePos(a, b) { return a && b && a[0] === b[0] && a[1] === b[1]; }
function addPos(p, d) { return [p[0] + d[0], p[1] + d[1]]; }
function key(p) { return p[0] + "," + p[1]; }
function delta(d) { return { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d] || [0, 0]; }
function directionTo(a, b) { if (b[0] > a[0]) return "right"; if (b[0] < a[0]) return "left"; if (b[1] > a[1]) return "down"; return "up"; }
function reverseDir(d) { return { up: "down", down: "up", left: "right", right: "left" }[d]; }
function isPassable(p, map) { if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return false; var t = map[p[0]][p[1]]; return t !== "x" && t !== "m"; }
function getTile(p, map) { if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return null; return map[p[0]][p[1]]; }