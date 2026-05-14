/**
 * AgenTank AI Agent - XDB (Strategic Assassin V5)
 *  (STRATEGY.md / chonggou.md)
 * Kill (10000) > Stars (500) > Time
 */

// ---  (G_Blueprint) ---
var G_Blueprint = {
    enemyProfile: null,
    mapVision: null,
    initialized: false
};

// ---  (G_History) ---
var G_History = {
    lastEnemyPos: null,
    lastEnemyDir: "up",
    lastEnemySeenFrame: -1,
    stuckCounter: 0,
    path: [],
    pathTarget: null,
    postTeleportFrames: 0,
    frame: 0
};

var CONFIG = {
    KILL_PRIO: 10000,
    STAR_PRIO: 500,
    TIME_COST: 1,
    MAX_A_STAR_NODES: 600,
    TURN_COST: 0.8,
    PRECISION_DIST: 5
};

// --- [] ---
function onIdle(me, enemy, game) {
    try {
        G_History.frame = game.frames || game.frame || 0;
        if (G_History.postTeleportFrames > 0) G_History.postTeleportFrames--;

        // 1.  (Strategic Analyst) - 
        if (!G_Blueprint.initialized) {
            strategicInit(enemy, game.map);
        }

        // 2.  (Perception)
        var ctx = buildExecutionContext(me, enemy, game);

        // 3. 
        if (ctx.meStatus.stunned || ctx.meStatus.frozen) return;

        // 4.  (Emergency Defense) - 
        var defenseAction = tacticalDefense(ctx);
        if (defenseAction) {
            executeAction(me, defenseAction, ctx);
            return;
        }

        // 5.  (Tactical Analyst) - 
        var bestAction = tacticalAnalysis(ctx);

        // 6. 
        executeAction(me, bestAction, ctx);

    } catch (e) {
        print("RUNTIME ERROR: " + e.message);
    }
}

// --- [1. ] ---
function strategicInit(enemy, map) {
    G_Blueprint.mapVision = analyzeMap(map);
    if (enemy) {
        G_Blueprint.enemyProfile = buildEnemyProfile(enemy);
        print("Strategy Initialized: Anti-" + G_Blueprint.enemyProfile.skillType);
    }
    G_Blueprint.initialized = true;
}

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

function buildEnemyProfile(enemy) {
    var s = enemy.skill, type = s ? s.type : "none";
    var cd = s ? s.remainingCooldownFrames : Infinity;
    return {
        skillType: type,
        isControl: (type === "stun" || type === "freeze" || type === "poison"),
        isSpeed: (type === "boost"),
        isBurst: (type === "overload"),
        isStealth: (type === "cloak"),
        controlRadius: (type === "stun" ? 9 : (type === "freeze" ? 8 : (type === "poison" ? 7 : 0))),
        minSafeDist: (type === "boost" ? 6 : (type === "overload" ? 5 : 3))
    };
}

// --- [2. ] ---
function tacticalAnalysis(ctx) {
    var candidates = [];

    // []
    if (ctx.canTeleport) {
        var assassinate = evalAssassination(ctx);
        if (assassinate) candidates.push(assassinate);
    }

    // []
    var shoot = evalShooting(ctx);
    if (shoot) candidates.push(shoot);

    // []
    var star = evalStarCollection(ctx);
    if (star) candidates.push(star);

    // [/]
    candidates.push(evalSurvival(ctx));

    // Kill > Stars > Time
    candidates.sort(function(a, b) { return b.score - a.score; });
    return candidates[0];
}

function evalAssassination(ctx) {
    if (!ctx.enemyPos || (G_Blueprint.enemyProfile && ctx.enemyShielded)) return null;

    //  Control 
    if (G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.isControl && ctx.enemySkillReady && !ctx.enemyFireLocked) return null;

    var isVulnerable = ctx.enemyFireLocked || (G_History.frame - G_History.lastEnemySeenFrame < 2);
    if (isVulnerable) {
        var spot = findAssassinSpot(ctx);
        if (spot && isSafe(spot, ctx, true)) {
            return { action: "teleport", target: spot, score: CONFIG.KILL_PRIO + 100 };
        }
    }
    return null;
}

function evalShooting(ctx) {
    if (!ctx.enemyPos || !ctx.enemyVisible || ctx.enemyShielded) return null;

    if (canShoot(ctx.myPos, ctx.enemyPos, ctx.map)) {
        var dir = directionTo(ctx.myPos, ctx.enemyPos);
        if (ctx.myDir === dir) {
            return { action: "fire", target: ctx.enemyPos, score: CONFIG.KILL_PRIO };
        } else {
            return { action: "turn", target: ctx.enemyPos, score: CONFIG.KILL_PRIO - 50 };
        }
    }

    //  ( Boost/Cloak)
    var pShot = findPredictiveShot(ctx);
    if (pShot) {
        var pDir = directionTo(ctx.myPos, pShot.pos);
        var score = CONFIG.STAR_PRIO + 100 + pShot.confidence * 20;
        if (ctx.myDir === pDir) return { action: "fire", target: pShot.pos, score: score };
        if (pShot.confidence >= 4) return { action: "turn", target: pShot.pos, score: score - 20 };
    }
    return null;
}

function evalStarCollection(ctx) {
    if (!ctx.starPos) return null;
    var dist = getDist(ctx.myPos, ctx.starPos);
    var score = CONFIG.STAR_PRIO - dist;
    
    // 
    if (ctx.meStars <= ctx.enemyStars) score += 200;
    if (dist <= 3) score += 300; // 

    // 
    if (ctx.canTeleport && dist > 12 && !ctx.enemyVisible) {
        if (isSafe(ctx.starPos, ctx, false)) {
            return { action: "teleport", target: ctx.starPos, score: CONFIG.STAR_PRIO + 400 };
        }
    }

    return { action: "move", target: ctx.starPos, score: score };
}

function evalSurvival(ctx) {
    var center = [Math.floor(G_Blueprint.mapVision.width/2), Math.floor(G_Blueprint.mapVision.height/2)];
    return { action: "move", target: center, score: 0 }; // 
}

// --- [3. ] ---
function executeAction(me, act, ctx) {
    if (!act) return;
    
    if (G_History.frame % 30 === 0) print("Exec: " + act.action + " Score: " + act.score);

    if (act.action === "fire") {
        if (!me.bullet && !ctx.meStatus.fireLocked) me.fire();
        return;
    }
    if (act.action === "turn") {
        me.turn(directionTo(ctx.myPos, act.target));
        return;
    }
    if (act.action === "teleport") {
        me.teleport(act.target[0], act.target[1]);
        G_History.postTeleportFrames = 5;
        return;
    }
    if (act.action === "move") {
        var next = getNextStep(ctx.myPos, act.target, ctx);
        if (next) doMove(me, next, ctx);
    }
}

function tacticalDefense(ctx) {
    var bullet = ctx.enemyBullet;
    if (!bullet) return null;

    var framesToHit = getFramesToHit(ctx.myPos, bullet, ctx.map);
    if (framesToHit <= 3) {
        var dodge = findBestDodge(ctx, framesToHit);
        if (ctx.canTeleport) {
            var moveFrames = (dodge && ctx.myDir === directionTo(ctx.myPos, dodge)) ? 1 : 2;
            if (!dodge || moveFrames >= framesToHit) {
                var escapeSpot = findEscapeSpot(ctx);
                if (escapeSpot) return { action: "teleport", target: escapeSpot, score: 99999 };
            }
        }
        if (dodge) return { action: "move", target: dodge, score: 99999 };
    }
    return null;
}

// --- [4. ] ---

function getNextStep(start, goal, ctx) {
    if (samePos(start, goal)) return null;
    
    // 
    if (G_History.pathTarget && samePos(goal, G_History.pathTarget) && G_History.path.length > 0) {
        var next = G_History.path[0];
        if (isPassable(next, ctx.map) && isSafe(next, ctx, false)) {
            return G_History.path.shift();
        }
    }

    var path = aStar(start, goal, ctx);
    if (path && path.length > 0) {
        G_History.pathTarget = goal;
        G_History.path = path;
        return G_History.path.shift();
    }
    
    //  A* 
    var blind = nextStepToward(start, goal, ctx.map);
    if (blind && isSafe(blind, ctx, false)) return blind;
    
    return null;
}

function aStar(start, goal, ctx) {
    var open = [{ pos: start, g: 0, h: getDist(start, goal), path: [], dir: ctx.myDir }];
    var closed = {};
    var nodes = 0;

    while (open.length > 0 && nodes < CONFIG.MAX_A_STAR_NODES) {
        open.sort(function(a, b) { return (a.g + a.h) - (b.g + b.h); });
        var curr = open.shift();
        nodes++;

        if (samePos(curr.pos, goal)) return curr.path;
        var k = key(curr.pos);
        if (closed[k] && closed[k] <= curr.g) continue;
        closed[k] = curr.g;

        var dirs = ["up", "right", "down", "left"];
        for (var i = 0; i < dirs.length; i++) {
            var d = dirs[i];
            var next = addPos(curr.pos, delta(d));
            if (isPassable(next, ctx.map) && isSafe(next, ctx, false)) {
                var cost = 1 + (curr.dir === d ? 0 : CONFIG.TURN_COST);
                var newPath = curr.path.slice();
                newPath.push(next);
                open.push({ pos: next, g: curr.g + cost, h: getDist(next, goal), path: newPath, dir: d });
            }
        }
    }
    return null;
}

function isSafe(pos, ctx, strict) {
    // 1. 
    if (getFramesToHit(pos, ctx.enemyBullet, ctx.map) <= 2) return false;

    // 2. 
    if (isInThreatLine(pos, ctx)) {
        if (strict) return false; // 
        if (getFramesToHit(pos, ctx.enemyBullet, ctx.map) <= 4) return false; // 
    }

    // 3.  (Strategic Exclusion Zones)
    if (G_Blueprint.enemyProfile && ctx.enemyPos) {
        var d = getDist(pos, ctx.enemyPos);
        // 
        if (G_Blueprint.enemyProfile.isControl && ctx.enemySkillReady && d <= G_Blueprint.enemyProfile.controlRadius) {
            if (strict || isInThreatLine(pos, ctx)) return false;
        }
        // 
        if (d < G_Blueprint.enemyProfile.minSafeDist) return false;
        // 
        if (strict && G_History.postTeleportFrames > 0 && d <= 4) return false;
    }

    return true;
}

// --- [5. ] ---

function buildExecutionContext(me, enemy, game) {
    var eTank = enemy ? enemy.tank : null;
    if (eTank) {
        G_History.lastEnemyPos = eTank.position;
        G_History.lastEnemyDir = eTank.direction;
        G_History.lastEnemySeenFrame = G_History.frame;
    }
    return {
        me: me, myPos: me.tank.position, myDir: me.tank.direction, meStars: me.stars,
        meStatus: me.status || {},
        enemy: enemy, enemyPos: G_History.lastEnemyPos, 
        enemyDir: G_History.lastEnemyDir,
        enemyVisible: !!eTank,
        enemyStars: enemy ? enemy.stars : 0,
        enemySkillReady: enemy && enemy.skill && enemy.skill.remainingCooldownFrames === 0,
        enemyFireLocked: enemy && enemy.status && enemy.status.fireLocked,
        enemyShielded: enemy && enemy.status && enemy.status.shielded,
        enemyBullet: enemy ? enemy.bullet : null,
        starPos: game.star, map: game.map,
        canTeleport: me.skill && me.skill.remainingCooldownFrames === 0
    };
}

function isInThreatLine(pos, ctx) {
    if (!ctx.enemyPos) return false;
    // 
    if (isLoS(ctx.enemyPos, pos, ctx.enemyDir, ctx.map)) return true;
    //  Overload ()
    if (G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.isBurst) {
        var sideA = addPos(ctx.enemyPos, delta(getRightDir(ctx.enemyDir)));
        var sideB = addPos(ctx.enemyPos, delta(getLeftDir(ctx.enemyDir)));
        if (isLoS(sideA, pos, ctx.enemyDir, ctx.map)) return true;
        if (isLoS(sideB, pos, ctx.enemyDir, ctx.map)) return true;
    }
    //  ()
    var p1 = addPos(ctx.enemyPos, delta(ctx.enemyDir));
    if (isPassable(p1, ctx.map) && isLoS(p1, pos, ctx.enemyDir, ctx.map)) return true;
    
    return false;
}

function isLoS(start, end, dir, map) {
    if (start[0] !== end[0] && start[1] !== end[1]) return false;
    if (directionTo(start, end) !== dir) return false;
    var step = delta(dir), p = addPos(start, step);
    while (!samePos(p, end)) {
        if (G_Blueprint.mapVision.cover[key(p)]) return false;
        p = addPos(p, step);
    }
    return true;
}

function findPredictiveShot(ctx) {
    if (!ctx.enemyPos) return null;
    var p = ctx.enemyPos, dir = ctx.enemyDir, candidates = [];
    // 1. 
    for (var i = 1; i <= 4; i++) {
        p = addPos(p, delta(dir));
        if (!isPassable(p, ctx.map)) break;
        candidates.push({ pos: p, frames: i, confidence: 2 });
    }
    // 2. 
    if (ctx.starPos) {
        var step = nextStepToward(ctx.enemyPos, ctx.starPos, ctx.map);
        if (step) candidates.push({ pos: step, frames: 1, confidence: 4 });
    }
    
    var best = null, bestScore = -999;
    for (var j = 0; j < candidates.length; j++) {
        var c = candidates[j];
        if (!canShoot(ctx.myPos, c.pos, ctx.map)) continue;
        var bDist = getDist(ctx.myPos, c.pos);
        var bFrames = Math.ceil(bDist / 2);
        if (bFrames > c.frames + 1) continue;
        var score = c.confidence * 10 - bDist;
        if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
}

function findAssassinSpot(ctx) {
    var ePos = ctx.enemyPos, eDir = ctx.enemyDir;
    var sides = [getRightDir(eDir), getLeftDir(eDir), getOppositeDir(eDir)];
    for (var i = 0; i < sides.length; i++) {
        var s = addPos(ePos, delta(sides[i]));
        if (isPassable(s, ctx.map) && getDist(ctx.myPos, s) <= 12) return s;
    }
    return null;
}

function findEscapeSpot(ctx) {
    var offsets = [[3,0], [-3,0], [0,3], [0,-3], [2,2], [-2,-2]];
    for (var i = 0; i < offsets.length; i++) {
        var p = addPos(ctx.myPos, offsets[i]);
        if (isPassable(p, ctx.map) && isSafe(p, ctx, false)) return p;
    }
    return null;
}

function findBestDodge(ctx, hitLimit) {
    var dirs = ["up", "right", "down", "left"], best = null, maxH = -1;
    for (var i = 0; i < dirs.length; i++) {
        var n = addPos(ctx.myPos, delta(dirs[i]));
        if (!isPassable(n, ctx.map)) continue;
        var h = getFramesToHit(n, ctx.enemyBullet, ctx.map);
        if (h > maxH && h > hitLimit) { maxH = h; best = n; }
    }
    return best;
}

function getFramesToHit(pos, bullet, map) {
    if (!bullet) return Infinity;
    if (isLoS(bullet.position, pos, bullet.direction, map)) {
        return Math.ceil(getDist(pos, bullet.position) / 2);
    }
    return Infinity;
}

function doMove(me, next, ctx) {
    if (samePos(ctx.myPos, next)) { G_History.stuckCounter++; return; }
    G_History.stuckCounter = 0;
    var d = directionTo(ctx.myPos, next);
    if (ctx.myDir === d) me.go(); else me.turn(d);
}

function nextStepToward(start, goal, map) {
    var dirs = ["up", "right", "down", "left"], best = null, minDist = getDist(start, goal);
    for (var i = 0; i < dirs.length; i++) {
        var n = addPos(start, delta(dirs[i]));
        if (isPassable(n, map)) {
            var d = getDist(n, goal);
            if (d < minDist) { minDist = d; best = n; }
        }
    }
    return best;
}

function canShoot(a, b, map) {
    if (a[0] !== b[0] && a[1] !== b[1]) return false;
    var dir = directionTo(a, b), step = delta(dir), p = addPos(a, step);
    while (!samePos(p, b)) {
        if (G_Blueprint.mapVision.cover[key(p)]) return false;
        p = addPos(p, step);
    }
    return true;
}

function getDist(a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
function samePos(a, b) { return a && b && a[0] === b[0] && a[1] === b[1]; }
function addPos(p, d) { return [p[0] + d[0], p[1] + d[1]]; }
function key(p) { return p[0] + "," + p[1]; }
function delta(d) { return { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }[d] || [0,0]; }
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
