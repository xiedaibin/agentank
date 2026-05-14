/**
 * AgenTank AI Agent - XDB (Teleport Assassin V4.1)
 * 
 * 核心准则 (STRATEGY.md):
 * 1. 击杀 (Kill) > 星星 (Stars) > 时间 (Time)
 * 2. Teleport 刺客流：主动传送背杀，而非仅用于防御
 * 3. 静态缓存与战略脱耦：EnemyProfile 一次构建，差异化模块动态激活
 * 4. 禁止使用 {x, y} 坐标，必须使用 [x, y]
 */

// --- 全局持久状态 ---
var G_EnemyProfile = null;
var G_MapVision = null;
var G_History = {
    pos: [],
    enemyPos: [],
    lastEnemySeen: -1,
    path: [],
    pathTarget: null,
    frame: 0,
    stuckCounter: 0,
    postTeleportFrames: 0 // 传送后火控锁定计时
};

var CONFIG = {
    KILL_SCORE: 10000,
    STAR_SCORE: 500,
    SAFETY_SCORE: 100,
    PRECISION_TELEPORT_DIST: 5, // 避开 4 格火控锁定的最佳背杀距离
    MAX_A_STAR_NODES: 400,
    MAX_HISTORY: 10,
    TURN_COST: 1.2,
    GRASS_BONUS: -0.5
};

// --- 主入口 ---
function onIdle(me, enemy, game) {
    try {
        G_History.frame = game.frames || game.frame || 0;
        if (G_History.postTeleportFrames > 0) G_History.postTeleportFrames--;

        // 1. 初始化静态资源
        if (!G_EnemyProfile && enemy) {
            G_EnemyProfile = buildEnemyProfile(enemy);
            print("Profile Init: " + (G_EnemyProfile.skillType || "none"));
        }
        if (!G_MapVision) {
            G_MapVision = analyzeMap(game.map);
        }

        // 2. 环境感知
        updateHistory(me, enemy);
        var ctx = buildContext(me, enemy, game);

        // 3. 状态异常处理 (Freeze/Stun)
        if (ctx.me.status && (ctx.me.status.stunned || ctx.me.status.frozen)) return;

        // 4. 紧急防御重写 (最高优先级)
        var threat = getBulletThreat(ctx.myPos, ctx);
        if (threat.framesToHit <= 3) {
            var dodge = findBestDodge(ctx, threat.framesToHit);
            // 如果走位来不及或没有走位空间，尝试传送逃生
            if (ctx.isSkillReady) {
                var framesNeeded = (dodge && ctx.myDir === directionTo(ctx.myPos, dodge)) ? 1 : 2;
                if (!dodge || framesNeeded >= threat.framesToHit) {
                    if (tryTeleportEscape(ctx)) return;
                }
            }
            if (dodge) {
                executeMove(me, dodge, ctx);
                return;
            }
        }

        // 5. 针对性战术姿态 (Anti-Skill Modules)
        if (G_EnemyProfile) {
            // Anti-Cloak Zig-Zag
            if (G_EnemyProfile.cloaked && G_History.frame % 3 === 0) {
                var zig = findZigZagMove(ctx);
                if (zig) { executeMove(me, zig, ctx); return; }
            }
            // Anti-Poison: 减速期间优先直线撤退
            if (ctx.me.status && ctx.me.status.poisoned && threat.framesToHit < 10) {
                var retreat = findStraightRetreat(ctx);
                if (retreat) { executeMove(me, retreat, ctx); return; }
            }
        }

        // 6. 卡死自愈
        if (G_History.stuckCounter > 5) {
            G_History.stuckCounter = 0;
            var escape = safePatrol(ctx);
            if (escape) { executeMove(me, escape, ctx); return; }
        }

        // 7. 战略决策 (核心评估函数)
        var goal = strategicAnalysis(ctx);
        if (G_History.frame % 20 === 0) print("Goal: " + goal.action + " Prio: " + goal.priority);

        // 8. 战术执行
        executeGoal(me, goal, ctx);

    } catch (e) {
        print("CRITICAL ERROR: " + e.message);
    }
}

// --- 战略引擎 (评估函数) ---
function strategicAnalysis(ctx) {
    var candidates = [];

    // [战略 A] 击杀：传送背杀 (Teleport Assassin)
    if (ctx.isSkillReady) {
        var assassinate = evaluateAssassination(ctx);
        if (assassinate) candidates.push(assassinate);
    }

    // [战略 B] 击杀：直接射击或预测射击
    var shoot = evaluateShooting(ctx);
    if (shoot) candidates.push(shoot);

    // [战略 C] 星星：高效率抢星
    var star = evaluateStar(ctx);
    if (star) candidates.push(star);

    // [战略 D] 生存：中场控制与规避
    var survival = evaluateSurvival(ctx);
    if (survival) candidates.push(survival);

    candidates.sort(function(a, b) { return b.priority - a.priority; });
    return candidates[0] || { target: ctx.myPos, action: "wait", priority: 0 };
}

function evaluateAssassination(ctx) {
    if (!ctx.enemyPos || G_EnemyProfile.shielded) return null;

    // 如果敌人控制技能就绪且我们在其半径内，刺杀风险极高
    if (G_EnemyProfile.control && G_EnemyProfile.ready) {
        // 除非敌人正在火控僵直中，否则不主动进入其控制范围
        if (!ctx.enemyFireLocked) return null;
    }

    // 僵直背杀 (Stun-Lock): 敌方开火僵直
    var isVulnerable = ctx.enemyFireLocked;
    // T字反击或背后暴露
    var isExposed = ctx.enemyDir && isBackFacing(ctx.enemyDir, directionTo(ctx.enemyPos, ctx.myPos));

    if (isVulnerable || isExposed) {
        var spot = findAssassinationSpot(ctx);
        if (spot && isLocationSafe(spot, ctx, true)) {
            return { target: spot, action: "teleport", priority: CONFIG.KILL_SCORE + 100 };
        }
    }
    return null;
}

function evaluateShooting(ctx) {
    if (!ctx.enemyVisible || !ctx.enemyPos || ctx.enemyShielded) return null;

    // 直接射击
    if (canShoot(ctx.myPos, ctx.enemyPos, ctx.map)) {
        var dir = directionTo(ctx.myPos, ctx.enemyPos);
        if (ctx.myDir === dir) {
            if (!ctx.me.bullet && !ctx.me.status.fireLocked) {
                return { target: ctx.enemyPos, action: "fire", priority: CONFIG.KILL_SCORE };
            }
        } else {
            return { target: ctx.enemyPos, action: "turn", priority: CONFIG.KILL_SCORE - 10 };
        }
    }

    // 预测射击 (Predictive Fire)
    var pShot = findPredictiveShot(ctx);
    if (pShot) {
        var pDir = directionTo(ctx.myPos, pShot.pos);
        var score = CONFIG.KILL_SCORE - 200 + pShot.confidence * 20;
        if (ctx.myDir === pDir) return { target: pShot.pos, action: "fire", priority: score };
        if (pShot.confidence >= 3) return { target: pShot.pos, action: "turn", priority: score - 50 };
    }
    return null;
}

function evaluateStar(ctx) {
    if (!ctx.starPos) return null;
    var dist = getDist(ctx.myPos, ctx.starPos);
    var priority = CONFIG.STAR_SCORE - dist;
    if (ctx.me.stars <= ctx.enemyStars) priority += 200;

    // 开局抢星传送
    if (ctx.isSkillReady && dist > 10 && !ctx.enemyVisible) {
        if (isLocationSafe(ctx.starPos, ctx, false)) {
            return { target: ctx.starPos, action: "teleport", priority: CONFIG.STAR_SCORE + 100 };
        }
    }

    return { target: ctx.starPos, action: "move", priority: priority };
}

function evaluateSurvival(ctx) {
    var target = [Math.floor(G_MapVision.width/2), Math.floor(G_MapVision.height/2)];
    if (isInEnemyThreatLine(ctx.myPos, ctx) || isPredictedEnemyThreatLine(ctx.myPos, ctx)) {
        var dodge = findBestDodge(ctx, 10);
        if (dodge) return { target: dodge, action: "move", priority: CONFIG.SAFETY_SCORE + 50 };
    }
    return { target: target, action: "move", priority: CONFIG.SAFETY_SCORE };
}

// --- 战术执行 ---
function executeGoal(me, goal, ctx) {
    if (!goal || goal.action === "wait") return;

    if (goal.action === "fire") {
        if (!me.bullet && !me.status.fireLocked) me.fire();
        return;
    }
    if (goal.action === "turn") {
        me.turn(directionTo(ctx.myPos, goal.target));
        return;
    }
    if (goal.action === "teleport") {
        me.teleport(goal.target[0], goal.target[1]);
        G_History.postTeleportFrames = 5;
        return;
    }
    if (goal.action === "move") {
        var step = getNextStep(ctx.myPos, goal.target, ctx);
        if (step) executeMove(me, step, ctx);
    }
}

function executeMove(me, targetPos, ctx) {
    if (samePos(ctx.myPos, targetPos)) {
        G_History.stuckCounter++;
        return;
    }
    G_History.stuckCounter = 0;
    var dir = directionTo(ctx.myPos, targetPos);
    if (ctx.myDir === dir) me.go(); else me.turn(dir);
}

// --- EnemyProfile 精细建模 ---
function buildEnemyProfile(enemy) {
    var s = enemy ? enemy.skill : null;
    var type = s ? s.type : null;
    var cd = s ? s.remainingCooldownFrames : Infinity;
    
    return {
        skillType: type,
        ready: cd === 0,
        control: (type === "stun" || type === "freeze" || type === "poison"),
        boost: (type === "boost"),
        overload: (type === "overload"),
        cloak: (type === "cloak"),
        teleport: (type === "teleport"),
        shield: (type === "shield"),
        controlRadius: (type === "stun" ? 9 : (type === "freeze" ? 8 : (type === "poison" ? 7 : 0))),
        minSafe: (type === "boost" ? 4 : 2)
    };
}

// --- 寻路与地图分析 ---
function analyzeMap(map) {
    var w = map.length, h = map[0].length;
    var vision = { width: w, height: h, cover: {}, grass: {} };
    for (var x = 0; x < w; x++) {
        for (var y = 0; y < h; y++) {
            var t = map[x][y];
            if (t === "x" || t === "m") vision.cover[x + "," + y] = true;
            if (t === "o") vision.grass[x + "," + y] = true;
        }
    }
    return vision;
}

function getNextStep(start, goal, ctx) {
    if (G_History.pathTarget && samePos(goal, G_History.pathTarget) && G_History.path.length > 0) {
        var next = G_History.path[0];
        if (isPassable(next, ctx.map) && isLocationSafe(next, ctx, false)) {
            return G_History.path.shift();
        }
    }
    var path = aStar(start, goal, ctx);
    if (path && path.length > 0) {
        G_History.pathTarget = goal;
        G_History.path = path;
        return G_History.path.shift();
    }
    return null;
}

function aStar(start, goal, ctx) {
    var queue = [{ pos: start, path: [], g: 0, h: getDist(start, goal), dir: ctx.myDir }];
    var visited = {};
    var nodes = 0;

    while (queue.length > 0 && nodes < CONFIG.MAX_A_STAR_NODES) {
        queue.sort(function(a, b) { return (a.g + a.h) - (b.g + b.h); });
        var curr = queue.shift();
        nodes++;

        if (samePos(curr.pos, goal)) return curr.path;
        var k = key(curr.pos);
        if (visited[k] && visited[k] <= curr.g) continue;
        visited[k] = curr.g;

        var dirs = ["up", "right", "down", "left"];
        for (var i = 0; i < dirs.length; i++) {
            var next = addPos(curr.pos, delta(dirs[i]));
            if (isPassable(next, ctx.map) && isLocationSafe(next, ctx, false)) {
                var turnCost = (curr.dir === dirs[i]) ? 0 : CONFIG.TURN_COST;
                var grassBonus = G_MapVision.grass[key(next)] ? CONFIG.GRASS_BONUS : 0;
                var newPath = curr.path.slice();
                newPath.push(next);
                queue.push({
                    pos: next, path: newPath,
                    g: curr.g + 1 + turnCost + grassBonus,
                    h: getDist(next, goal),
                    dir: dirs[i]
                });
            }
        }
    }
    return null;
}

// --- 安全与威胁判定 ---
function isLocationSafe(pos, ctx, strict) {
    var threat = getBulletThreat(pos, ctx);
    if (threat.framesToHit <= 2) return false;

    if (isInEnemyThreatLine(pos, ctx) || isPredictedEnemyThreatLine(pos, ctx)) {
        if (strict || threat.framesToHit <= 3) return false;
    }

    if (G_EnemyProfile && ctx.enemyPos) {
        var dist = getDist(pos, ctx.enemyPos);
        if (G_EnemyProfile.control && G_EnemyProfile.ready && dist <= G_EnemyProfile.controlRadius) return false;
        if (G_EnemyProfile.minSafe && dist < G_EnemyProfile.minSafe) return false;
        if (G_History.postTeleportFrames > 0 && dist <= 4) return false;
    }

    return true;
}

function getBulletThreat(pos, ctx) {
    if (!ctx.bullet) return { framesToHit: Infinity };
    var b = ctx.bullet;
    if (isLineOfSight(b.position, pos, b.direction, ctx.map)) {
        return { framesToHit: Math.ceil(getDist(pos, b.position) / 2) };
    }
    return { framesToHit: Infinity };
}

function isInEnemyThreatLine(pos, ctx) {
    if (!ctx.enemyPos) return false;
    return isThreatLineFrom(pos, ctx.enemyPos, ctx.enemyDir, ctx);
}

function isPredictedEnemyThreatLine(pos, ctx) {
    if (!ctx.enemyPos) return false;
    var ePos = ctx.enemyPos, eDir = ctx.enemyDir;
    var p1 = addPos(ePos, delta(eDir));
    if (isPassable(p1, ctx.map) && isThreatLineFrom(pos, p1, eDir, ctx)) return true;
    
    if (G_EnemyProfile && G_EnemyProfile.overload) {
        if (isThreatLineFrom(pos, ePos, getRightDir(eDir), ctx)) return true;
        if (isThreatLineFrom(pos, ePos, getLeftDir(eDir), ctx)) return true;
    }
    return false;
}

function isThreatLineFrom(pos, shooterPos, dir, ctx) {
    if (isLineOfSight(shooterPos, pos, dir, ctx.map)) return true;
    if (G_EnemyProfile && G_EnemyProfile.overload) {
        var sideA = addPos(shooterPos, delta(getRightDir(dir)));
        var sideB = addPos(shooterPos, delta(getLeftDir(dir)));
        if (isLineOfSight(sideA, pos, dir, ctx.map)) return true;
        if (isLineOfSight(sideB, pos, dir, ctx.map)) return true;
    }
    return false;
}

function isLineOfSight(start, end, dir, map) {
    if (start[0] !== end[0] && start[1] !== end[1]) return false;
    if (directionTo(start, end) !== dir) return false;
    var step = delta(dir);
    var p = addPos(start, step);
    while (!samePos(p, end)) {
        if (G_MapVision.cover[key(p)]) return false;
        p = addPos(p, step);
    }
    return true;
}

function findPredictiveShot(ctx) {
    if (!ctx.enemyPos) return null;
    var ePos = ctx.enemyPos, eDir = ctx.enemyDir;
    var candidates = [];
    var p = ePos;
    for (var i = 1; i <= 4; i++) {
        p = addPos(p, delta(eDir));
        if (!isPassable(p, ctx.map)) break;
        candidates.push({ pos: p, enemyFrames: i, confidence: 2 });
    }
    if (ctx.starPos) {
        var step = nextStepToward(ePos, ctx.starPos, ctx.map);
        if (step) candidates.push({ pos: step, enemyFrames: 1, confidence: 3 });
    }
    var best = null, bestScore = -999;
    for (var j = 0; j < candidates.length; j++) {
        var c = candidates[j];
        if (!canShoot(ctx.myPos, c.pos, ctx.map)) continue;
        var bDist = getDist(ctx.myPos, c.pos);
        var bFrames = Math.ceil(bDist / 2);
        if (bFrames > c.enemyFrames + 1) continue;
        var score = c.confidence * 10 - Math.abs(bFrames - c.enemyFrames) - bDist;
        if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
}

function findAssassinationSpot(ctx) {
    var ePos = ctx.enemyPos, eDir = ctx.enemyDir;
    var sides = [getRightDir(eDir), getLeftDir(eDir)];
    for (var i = 0; i < sides.length; i++) {
        var s = addPos(ePos, delta(sides[i]));
        if (isPassable(s, ctx.map) && getDist(ctx.myPos, s) <= 10) return s;
    }
    var back = addPos(ePos, delta(getOppositeDir(eDir)));
    if (isPassable(back, ctx.map)) return back;
    return null;
}

function findBestDodge(ctx, threatFrames) {
    var dirs = ["up", "right", "down", "left"];
    var best = null, maxF = -1;
    for (var i = 0; i < dirs.length; i++) {
        var n = addPos(ctx.myPos, delta(dirs[i]));
        if (!isPassable(n, ctx.map)) continue;
        var f = getBulletThreat(n, ctx).framesToHit;
        if (f > maxF && f > threatFrames) { maxF = f; best = n; }
    }
    return best;
}

function tryTeleportEscape(ctx) {
    var offsets = [[2,2], [-2,-2], [2,-2], [-2,2], [3,0], [0,3], [-3,0], [0,-3]];
    for (var i = 0; i < offsets.length; i++) {
        var p = addPos(ctx.myPos, offsets[i]);
        if (isPassable(p, ctx.map) && isLocationSafe(p, ctx, false)) {
            if (getBulletThreat(p, ctx).framesToHit === Infinity) {
                ctx.me.teleport(p[0], p[1]);
                G_History.postTeleportFrames = 5;
                return true;
            }
        }
    }
    return false;
}

function findZigZagMove(ctx) {
    var perp = getRightDir(ctx.myDir);
    var n = addPos(ctx.myPos, delta(perp));
    if (isPassable(n, ctx.map) && isLocationSafe(n, ctx, false)) return n;
    perp = getLeftDir(ctx.myDir);
    n = addPos(ctx.myPos, delta(perp));
    if (isPassable(n, ctx.map) && isLocationSafe(n, ctx, false)) return n;
    return null;
}

function findStraightRetreat(ctx) {
    var opp = getOppositeDir(ctx.myDir);
    var n = addPos(ctx.myPos, delta(opp));
    if (isPassable(n, ctx.map) && isLocationSafe(n, ctx, false)) return n;
    return null;
}

function safePatrol(ctx) {
    var dirs = ["up", "right", "down", "left"];
    for (var i = 0; i < dirs.length; i++) {
        var n = addPos(ctx.myPos, delta(dirs[i]));
        if (isPassable(n, ctx.map) && isLocationSafe(n, ctx, false)) return n;
    }
    return null;
}

function buildContext(me, enemy, game) {
    var eTank = enemy ? enemy.tank : null;
    return {
        me: me, myPos: me.tank.position, myDir: me.tank.direction,
        enemy: enemy, enemyPos: eTank ? eTank.position : (G_History.enemyPos.length ? G_History.enemyPos[G_History.enemyPos.length-1] : null),
        enemyDir: eTank ? eTank.direction : "up",
        enemyVisible: !!eTank,
        enemyStars: enemy ? enemy.stars : 0,
        enemyFireLocked: enemy && enemy.status && enemy.status.fireLocked,
        enemyShielded: enemy && enemy.status && enemy.status.shielded,
        starPos: game.star, map: game.map, bullet: enemy ? enemy.bullet : null,
        isSkillReady: me.skill && me.skill.remainingCooldownFrames === 0
    };
}

function updateHistory(me, enemy) {
    G_History.pos.push(me.tank.position);
    if (enemy && enemy.tank) {
        G_History.enemyPos.push(enemy.tank.position);
        G_History.lastEnemySeen = G_History.frame;
    }
    if (G_History.pos.length > CONFIG.MAX_HISTORY) G_History.pos.shift();
    if (G_History.enemyPos.length > CONFIG.MAX_HISTORY) G_History.enemyPos.shift();
}

function canShoot(a, b, map) {
    if (a[0] !== b[0] && a[1] !== b[1]) return false;
    var d = directionTo(a, b), step = delta(d), p = addPos(a, step);
    while (!samePos(p, b)) {
        if (G_MapVision.cover[key(p)]) return false;
        p = addPos(p, step);
    }
    return true;
}

function nextStepToward(start, goal, map) {
    var dirs = ["up", "right", "down", "left"], best = null, bestDist = getDist(start, goal);
    for (var i = 0; i < dirs.length; i++) {
        var next = addPos(start, delta(dirs[i]));
        if (isPassable(next, map)) {
            var d = getDist(next, goal);
            if (d < bestDist) { bestDist = d; best = next; }
        }
    }
    return best;
}

function getDist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
function samePos(a, b) { return a && b && a[0] === b[0] && a[1] === b[1]; }
function addPos(p, d) { return [p[0] + d[0], p[1] + d[1]]; }
function key(p) { return p[0] + "," + p[1]; }
function delta(d) {
    var dict = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    return dict[d] || [0, 0];
}
function directionTo(a, b) {
    if (b[0] > a[0]) return "right"; if (b[0] < a[0]) return "left";
    if (b[1] > a[1]) return "down"; return "up";
}
function getOppositeDir(d) { return { up: "down", down: "up", left: "right", right: "left" }[d]; }
function getRightDir(d) { return { up: "right", right: "down", down: "left", left: "up" }[d]; }
function getLeftDir(d) { return { up: "left", left: "down", down: "right", right: "up" }[d]; }
function isPassable(p, map) {
    if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return false;
    var t = map[p[0]][p[1]];
    return t === "." || t === "o" || t === "s" || t === "b";
}
function isBackFacing(eDir, toMeDir) { return eDir === getOppositeDir(toMeDir); }
