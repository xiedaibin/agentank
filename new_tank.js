/**
 * AgenTank AI Agent - Map Vision & Strategic Assassin (V2 - Fixed)
 * 遵循 AGENTS.md：击杀 > 星星 > 时间
 * 特色：全局地图语义分析、环境意识寻路、Teleport 背杀
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
    frame: 0
};

var CONFIG = {
    KILL_SCORE: 10000,
    STAR_SCORE: 200,
    SAFETY_SCORE: 100,
    TELEPORT_DIST: 5,
    MAX_A_STAR_NODES: 300, // 稍微降低节点数以防超时
    MAX_HISTORY: 10
};

// --- 主入口 ---
function onIdle(me, enemy, game) {
    try {
        G_History.frame = game.frames || game.frame || 0;
        
        // 1. 初始化静态资源
        if (!G_EnemyProfile && enemy && enemy.skill) {
            G_EnemyProfile = buildEnemyProfile(enemy.skill.type);
            print("Profile Initialized: " + G_EnemyProfile.type);
        }
        if (!G_MapVision) {
            G_MapVision = analyzeMap(game.map);
            print("Map Vision System Initialized.");
        }

        // 2. 环境感知
        updateHistory(me, enemy);
        var ctx = buildContext(me, enemy, game);

        // 3. 战略决策 (Strategic Engine)
        var goal = strategicAnalysis(ctx);

        // 4. 战术执行 (Tactical Engine)
        executeGoal(me, goal, ctx);
    } catch (e) {
        print("CRITICAL ERROR in onIdle: " + e.message + " at " + e.stack);
    }
}

// --- 战略引擎 (Strategic Engine) ---
function strategicAnalysis(ctx) {
    var candidates = [];

    // [战略 A] 必杀机会
    var kill = evaluateAssassination(ctx);
    if (kill) candidates.push(kill);

    // [战略 B] 抢星策略
    var star = evaluateStar(ctx);
    if (star) candidates.push(star);

    // [战略 C] 动态生存与控制
    var survival = evaluateSurvival(ctx);
    if (survival) candidates.push(survival);

    candidates.sort(function(a, b) { return b.priority - a.priority; });
    
    // 如果没有找到可行目标，强制停留在原地或随机移动一步（防止卡死）
    return candidates[0] || { target: ctx.myPos, action: "move", priority: 0 };
}

function evaluateAssassination(ctx) {
    if (!ctx.enemyVisible || !ctx.enemyPos) return null;
    
    var isSkillReady = ctx.me.skill && ctx.me.skill.remainingCooldownFrames === 0;
    
    // 战术背杀判定 (Teleport Assassin)
    if (isSkillReady && (ctx.enemyFireLocked || isBackFacing(ctx.enemyDir, directionTo(ctx.enemyPos, ctx.myPos)))) {
        var spot = findAssassinationSpot(ctx.enemyPos, ctx.enemyDir, ctx.map);
        if (spot && isLocationSafe(spot, ctx, true)) { // 对传送落点使用严格安全校验
            return { target: spot, action: "teleport", priority: CONFIG.KILL_SCORE };
        }
    }

    // 普通射击判定 (增加预测射击)
    if (canShoot(ctx.myPos, ctx.enemyPos, ctx.map) && !ctx.enemyShielded) {
        var shotDir = directionTo(ctx.myPos, ctx.enemyPos);
        if (ctx.myDir === shotDir) {
            return { target: ctx.enemyPos, action: "fire", priority: CONFIG.KILL_SCORE - 50 };
        } else {
            return { target: ctx.enemyPos, action: "turn", priority: CONFIG.KILL_SCORE - 100 };
        }
    }
    return null;
}

function evaluateStar(ctx) {
    if (!ctx.starPos) return null;
    var dist = getDist(ctx.myPos, ctx.starPos);
    var priority = CONFIG.STAR_SCORE - dist;
    if (ctx.me.stars <= ctx.enemyStars) priority += 100;
    return { target: ctx.starPos, action: "move", priority: priority };
}

function evaluateSurvival(ctx) {
    var centerX = Math.floor(G_MapVision.width / 2);
    var centerY = Math.floor(G_MapVision.height / 2);
    var target = [centerX, centerY];

    // 如果受威胁，强制进入避弹逻辑
    var threat = getBulletThreat(ctx.myPos, ctx);
    if (threat.framesToHit < 8 || isInEnemyThreatLine(ctx.myPos, ctx)) {
        var dodge = findBestDodge(ctx);
        if (dodge) return { target: dodge, action: "move", priority: CONFIG.KILL_SCORE + 50 };
    }

    return { target: target, action: "move", priority: CONFIG.SAFETY_SCORE };
}

// --- 战术执行 (Tactical Engine) ---
function executeGoal(me, goal, ctx) {
    if (!goal) return;

    if (goal.action === "fire") { me.fire(); return; }
    if (goal.action === "turn") { me.turn(directionTo(ctx.myPos, goal.target)); return; }
    if (goal.action === "teleport") { 
        print("ASSASSINATION INITIATED: " + goal.target[0] + "," + goal.target[1]);
        me.teleport(goal.target[0], goal.target[1]); 
        return; 
    }

    var step = getNextStep(ctx.myPos, goal.target, ctx);
    if (step) {
        var dir = directionTo(ctx.myPos, step);
        if (ctx.myDir === dir) me.go();
        else me.turn(dir);
    }
}

// --- 地图分析与寻路 ---
function analyzeMap(map) {
    var width = map.length;
    var height = map[0].length;
    var vision = { width: width, height: height, cover: {}, grass: {} };
    for (var x = 0; x < width; x++) {
        for (var y = 0; y < height; y++) {
            var tile = map[x][y];
            var k = x + "," + y;
            if (tile === "x" || tile === "m") vision.cover[k] = true;
            if (tile === "o") vision.grass[k] = true;
        }
    }
    return vision;
}

function getNextStep(start, goal, ctx) {
    if (G_History.pathTarget && samePos(goal, G_History.pathTarget) && G_History.path.length > 0) {
        var next = G_History.path.shift();
        if (isPassable(next, ctx.map) && isLocationSafe(next, ctx, false)) return next;
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
        var k = curr.pos[0] + "," + curr.pos[1];
        if (visited[k] && visited[k] <= curr.g) continue;
        visited[k] = curr.g;

        var dirs = ["up", "right", "down", "left"];
        for (var i = 0; i < dirs.length; i++) {
            var next = addPos(curr.pos, delta(dirs[i]));
            if (isPassable(next, ctx.map) && isLocationSafe(next, ctx, false)) {
                var turnCost = (curr.dir === dirs[i]) ? 0 : 0.6; 
                var envBonus = G_MapVision.grass[next[0]+","+next[1]] ? -0.3 : 0; 
                
                var newPath = curr.path.slice();
                newPath.push(next);
                queue.push({
                    pos: next, path: newPath,
                    g: curr.g + 1 + turnCost + envBonus,
                    h: getDist(next, goal),
                    dir: dirs[i]
                });
            }
        }
    }
    return null;
}

// --- 安全判定系统 ---
function isLocationSafe(pos, ctx, strict) {
    // 1. 子弹直接威胁 (高优先级)
    var threat = getBulletThreat(pos, ctx);
    if (threat.framesToHit <= 2) return false;

    // 2. 枪线威胁
    if (isInEnemyThreatLine(pos, ctx)) {
        // 如果是寻路过程中的软威胁，且不是硬死亡，可以适当容忍 (防止坦克不动)
        if (strict || threat.framesToHit <= 3) return false;
    }

    // 3. 敌方极近距离禁区
    if (ctx.enemyPos) {
        var dist = getDist(pos, ctx.enemyPos);
        var minSafe = G_EnemyProfile ? G_EnemyProfile.minSafe : 3;
        if (dist < minSafe) return false;
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
    if (isLineOfSight(ctx.enemyPos, pos, ctx.enemyDir, ctx.map)) return true;
    
    var steps = G_EnemyProfile ? G_EnemyProfile.predictSteps : 1;
    var eIter = ctx.enemyPos;
    for (var i = 0; i < steps; i++) {
        eIter = addPos(eIter, delta(ctx.enemyDir));
        if (!isPassable(eIter, ctx.map)) break;
        if (isLineOfSight(eIter, pos, ctx.enemyDir, ctx.map)) return true;
    }
    return false;
}

function isLineOfSight(start, end, dir, map) {
    if (start[0] !== end[0] && start[1] !== end[1]) return false;
    var d = directionTo(start, end);
    if (d !== dir) return false;
    var step = delta(d);
    var p = addPos(start, step);
    while (!samePos(p, end)) {
        if (G_MapVision.cover[p[0] + "," + p[1]]) return false;
        p = addPos(p, step);
    }
    return true;
}

// --- 针对性策略库 (Specific Modules) ---
function buildEnemyProfile(type) {
    var p = { type: type, minSafe: 3, predictSteps: 1 };
    if (type === "boost") { p.minSafe = 5; p.predictSteps = 3; }
    if (type === "teleport") { p.minSafe = 4; p.predictSteps = 2; }
    if (type === "cloak") { p.minSafe = 4; p.predictSteps = 4; }
    if (type === "freeze" || type === "stun") { p.minSafe = 8; p.predictSteps = 1; }
    return p;
}

function findAssassinationSpot(ePos, eDir, map) {
    var opp = getOppositeDir(eDir);
    var spot = ePos;
    for (var i = 0; i < CONFIG.TELEPORT_DIST; i++) {
        spot = addPos(spot, delta(opp));
    }
    if (isPassable(spot, map)) return spot;
    
    // 侧击落点
    var right = getRightDir(eDir);
    var side = addPos(ePos, delta(right));
    if (isPassable(side, map)) return side;
    
    return null;
}

function findBestDodge(ctx) {
    var dirs = ["up", "right", "down", "left"];
    var best = null; var maxF = -1;
    for (var i = 0; i < dirs.length; i++) {
        var n = addPos(ctx.myPos, delta(dirs[i]));
        if (isPassable(n, ctx.map)) {
            var f = getBulletThreat(n, ctx).framesToHit;
            if (f > maxF) { maxF = f; best = n; }
        }
    }
    return best;
}

// --- 基础工具库 ---
function buildContext(me, enemy, game) {
    var eTank = enemy ? enemy.tank : null;
    return {
        me: me, myPos: me.tank.position, myDir: me.tank.direction,
        enemy: enemy,
        enemyPos: eTank ? eTank.position : (G_History.enemyPos.length ? G_History.enemyPos[G_History.enemyPos.length-1] : null),
        enemyDir: eTank ? eTank.direction : "up",
        enemyVisible: !!eTank,
        enemyStars: enemy ? enemy.stars : 0,
        enemyFireLocked: enemy && (enemy.status && enemy.status.fireLocked),
        enemyShielded: enemy && (enemy.status && enemy.status.shielded),
        starPos: game.star,
        map: game.map,
        bullet: enemy ? enemy.bullet : null
    };
}

function updateHistory(me, enemy) {
    G_History.pos.push(me.tank.position);
    if (enemy && enemy.tank) G_History.enemyPos.push(enemy.tank.position);
    if (G_History.pos.length > CONFIG.MAX_HISTORY) G_History.pos.shift();
    if (G_History.enemyPos.length > CONFIG.MAX_HISTORY) G_History.enemyPos.shift();
}

function canShoot(a, b, map) {
    if (a[0] !== b[0] && a[1] !== b[1]) return false;
    var d = directionTo(a, b);
    var step = delta(d);
    var p = addPos(a, step);
    while (!samePos(p, b)) {
        if (!isTransparent(p, map)) return false;
        p = addPos(p, step);
    }
    return true;
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
function getOppositeDir(d) {
    var dict = { up: "down", down: "up", left: "right", right: "left" };
    return dict[d];
}
function getRightDir(d) {
    var dict = { up: "right", right: "down", down: "left", left: "up" };
    return dict[d];
}
function isPassable(p, map) {
    if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return false;
    var t = map[p[0]][p[1]];
    return t === "." || t === "o" || t === "s" || t === "b";
}
function isTransparent(p, map) {
    if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return false;
    var t = map[p[0]][p[1]];
    return t !== "x" && t !== "m";
}
function isBackFacing(eDir, toMeDir) {
    return eDir === getOppositeDir(toMeDir);
}
