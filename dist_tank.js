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
    lastEnemyVisible: false, wasEnemyVisible: false, lastUpdatedFrame: -99,
    isEnemyPosPredicted: false, invalidPredictedSpots: {}, firedPredictedSpots: {},
    cloakFramesLeft: 0, postTeleportFrames: 0, frame: 0,
    defenseLockTicks: 0, lastDefenseTarget: null,
    path: [], pathTarget: null, stuckTurnCount: 0, lastPos: null,
    lastEnemyOverloadedFrame: null,
    lastAttemptedStep: null,
    starTeleportFrame: -99,
    lastStarPos: null,
    enemyInvisibleFrames: 0,
    isAmbushStreamDetected: false,
    failedTeleportSpots: {},
    lastTeleportTarget: null,
    lastTeleportFrame: -99,
    lastTeleportPos: null,
    hasSpokenBullet: false,
    lastEnemyStars: 0,
    wasMeInGrass: false,
    lastGrassEntrancePos: null,
    hasShiftedInGrass: false,
    lastLeftGrassPos: null,
    lastLeftGrassFrame: -99,
    recentDodgeSource: {}
};
var CONFIG = { KILL_PRIO: 10000, STAR_PRIO: 800, TURN_COST: 0.8, BLIND_FIRE_FRAMES: 3 };
var G_SafeCache = {};
var G_DangerTiles = {};
var G_AStarCache = {};
var G_CanShootCache = {};
var G_LoSCache = {};
var G_OnGunLineCache = {};
function onIdle(me, enemy, game) {
    try {
        var originalTurn = me.turn;
        me.turn = function (dir) {
            var ePos = (enemy && enemy.tank) ? enemy.tank.position : (G_History.lastEnemyPos || null);
            var turnDir = getTurnDir(me.tank.direction, dir, ePos, me.tank.position, game.map);
            if (turnDir) {
                originalTurn.call(me, turnDir);
            }
        };
        G_History.frame = game.frames || 0;
        G_SafeCache = {};
        G_AStarCache = {};
        G_CanShootCache = {};
        G_LoSCache = {};
        G_OnGunLineCache = {};
        if (G_History.lastTeleportTarget && G_History.frame === G_History.lastTeleportFrame + 1) {
            if (samePos(me.tank.position, G_History.lastTeleportPos)) {
                if (!G_History.failedTeleportSpots) G_History.failedTeleportSpots = {};
                G_History.failedTeleportSpots[G_History.lastTeleportTarget[0] + "," + G_History.lastTeleportTarget[1]] = G_History.frame;
            }
            G_History.lastTeleportTarget = null;
        }
        if (enemy && enemy.status && enemy.status.overloaded) {
            G_History.lastEnemyOverloadedFrame = G_History.frame;
        }
        if (G_History.frame <= 1 && !G_History.hasSpokenInit) {
            G_History.hasSpokenInit = true;
        }
        if (G_History.postTeleportFrames > 0) G_History.postTeleportFrames--;
        if (G_History.cloakFramesLeft > 0) G_History.cloakFramesLeft--;
        if (!G_Blueprint.initialized || (enemy && !G_Blueprint.enemySeen)) strategicInit(enemy, game.map);
        var ctx = buildExecutionContext(me, enemy, game);
        if (ctx.meStatus.frozen) return;
        if (ctx.meStatus.stunned) {
            var coAxial = ctx.enemyPos && (ctx.myPos[0] === ctx.enemyPos[0] || ctx.myPos[1] === ctx.enemyPos[1]);
            if (!coAxial) return;
        }
        if (ctx.enemyBullet) {
            if (!G_History.hasSpokenBullet) {
                G_History.hasSpokenBullet = true;
            }
        } else {
            G_History.hasSpokenBullet = false;
        }
        var lastAttempted = G_History.lastAttemptedStep;
        G_History.lastAttemptedStep = null;
        if (lastAttempted && G_History.lastPos && samePos(ctx.myPos, G_History.lastPos)) {
            if (isPassable(lastAttempted, ctx.map)) {
                var dir = directionTo(ctx.myPos, lastAttempted);
                if (ctx.myDir === dir && !me.bullet && !ctx.meStatus.fireLocked) {
                    fireGun(me, ctx);
                    return;
                }
            }
        }
        var isTeleportAmbushStream = G_History.isAmbushStreamDetected && G_History.enemyInvisibleFrames >= 5;
        if ((isTeleportAmbushStream || ctx.enemyVisible) && !ctx.enemyShielded) {
            var cs = canShoot(ctx.myPos, ctx.enemyPos, ctx.map);
            if (cs === true || (cs === "mound" && getDist(ctx.myPos, ctx.enemyPos) <= 7)) {
                var dir = directionTo(ctx.myPos, ctx.enemyPos);
                if (ctx.myDir === dir && !me.bullet && !ctx.meStatus.fireLocked) {
                    var onOverloadLine = isOnEnemyGunLine(ctx.myPos, ctx, true);
                    var enemyFacingUs = isLoS(ctx.enemyPos, ctx.myPos, ctx.enemyDir, ctx.map);
                    if (onOverloadLine && enemyFacingUs && !ctx.enemyFireLocked && isEnemyOverloadActive(ctx, ctx.myPos)) {
                    } else {
                        fireGun(me, ctx); return;
                    }
                }
            }
        }
        if (!ctx.enemyVisible && ctx.isEnemyRecentlyInvisibleInGrass) {
            var targetGrass = findTargetGrassForBlindFire(ctx.myPos, ctx.myDir, G_History.lastEnemyPos, ctx.map);
            if (targetGrass && !me.bullet && !ctx.meStatus.fireLocked) {
                fireGun(me, ctx); return;
            }
        }
        var defenseAction = tacticalDefense(me, ctx);
        if (defenseAction) {
            defenseAction.isDefense = true;
            executeAction(me, defenseAction, ctx);
            return;
        }
        var bestAction = tacticalAnalysis(ctx);
        executeAction(me, bestAction, ctx);
    } catch (e) { print("Error: " + e.message); }
}
function strategicInit(enemy, map) {
    G_Blueprint.mapVision = analyzeMap(map);
    if (enemy) {
        G_Blueprint.enemySeen = true;
        var sType = (enemy.skill && enemy.skill.type) ? enemy.skill.type : "none";
        G_Blueprint.enemyProfile = {
            skillType: sType,
            hasOverload: (sType === "overload")
        };
        if (sType === "freeze") {
            G_Blueprint.Tactics = {
                STANCE: "ANTI_CONTROL", DANGER_RADIUS: 8, ASTAR_UNSAFE_PENALTY: 3000,
                ENABLE_ASSASSINATION: false, MAX_NODES: 200
            };
        } else if (sType === "stun") {
            G_Blueprint.Tactics = {
                STANCE: "ANTI_CONTROL", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 3000,
                ENABLE_ASSASSINATION: false, MAX_NODES: 200
            };
        } else if (sType === "overload") {
            G_Blueprint.Tactics = {
                STANCE: "DEFAULT", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 2000,
                ENABLE_ASSASSINATION: false, MAX_NODES: 250
            };
        } else if (sType === "shield") {
            G_Blueprint.Tactics = {
                STANCE: "DEFAULT", DANGER_RADIUS: 2, ASTAR_UNSAFE_PENALTY: 2000,
                ENABLE_ASSASSINATION: false, MAX_NODES: 250
            };
        } else if (sType === "teleport") {
            G_Blueprint.Tactics = {
                STANCE: "DEFAULT", DANGER_RADIUS: 1, ASTAR_UNSAFE_PENALTY: 2000,
                ENABLE_ASSASSINATION: true, MAX_NODES: 250
            };
        } else if (sType === "cloak") {
            G_Blueprint.Tactics = {
                STANCE: "ANTI_CLOAK", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 1500,
                ENABLE_ASSASSINATION: false, MAX_NODES: 200, JITTER: true
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
    var w = map.length, h = map[0].length;
    var v = { width: w, height: h, cover: {}, grass: {}, grassList: [] };
    for (var x = 0; x < w; x++) {
        for (var y = 0; y < h; y++) {
            var tile = map[x][y];
            if (tile === "x") v.cover[x + "," + y] = true;
            if (tile === "o") {
                v.grass[x + "," + y] = true;
                v.grassList.push([x, y]);
            }
        }
    }
    return v;
}
function buildExecutionContext(me, enemy, game) {
    var isOverload = false;
    if (enemy && G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload) {
        var recentlyOverloaded = G_History.lastEnemyOverloadedFrame && (G_History.frame - G_History.lastEnemyOverloadedFrame < 8);
        var enemySkillReady = enemy.skill && enemy.skill.remainingCooldownFrames <= 2;
        isOverload = (enemy.status && enemy.status.overloaded) || enemySkillReady || recentlyOverloaded;
    }
    buildDangerTilesCache(enemy ? enemy.bullet : null, game.map, isOverload);
    if (G_History.isEnemyPosPredicted && G_History.lastEnemyPos) {
        var myPos = me.tank.position;
        if (samePos(myPos, G_History.lastEnemyPos)) {
            var badSpotKey = G_History.lastEnemyPos[0] + "," + G_History.lastEnemyPos[1];
            if (!G_History.invalidPredictedSpots) G_History.invalidPredictedSpots = {};
            G_History.invalidPredictedSpots[badSpotKey] = true;
            recalculateAmbushPrediction(game.map);
        }
    }
    if (game && game.star) {
        G_History.lastStarPos = game.star;
    }
    var eTank = enemy ? enemy.tank : null;
    var visible = !!eTank;
    if (G_History.lastUpdatedFrame !== G_History.frame) {
        var didJustTeleport = G_History.lastTeleportFrame && (G_History.frame - G_History.lastTeleportFrame <= 2);
        var teleportSucceeded = didJustTeleport && G_History.lastTeleportPos && !samePos(me.tank.position, G_History.lastTeleportPos);
        var myPosInGrass = G_Blueprint.mapVision && G_Blueprint.mapVision.grass[me.tank.position[0] + "," + me.tank.position[1]];
        if (myPosInGrass) {
            if (!G_History.wasMeInGrass || teleportSucceeded) {
                G_History.lastGrassEntrancePos = me.tank.position.slice();
                G_History.hasShiftedInGrass = false;
            } else {
                if (G_History.lastGrassEntrancePos && !samePos(me.tank.position, G_History.lastGrassEntrancePos)) {
                    G_History.hasShiftedInGrass = true;
                }
            }
        } else {
            G_History.lastGrassEntrancePos = null;
            G_History.hasShiftedInGrass = false;
        }
        G_History.wasMeInGrass = !!myPosInGrass;
        if (visible) {
            G_History.enemyInvisibleFrames = 0;
        } else {
            G_History.enemyInvisibleFrames++;
        }
        if (G_History.frame <= 4 && !G_History.isAmbushStreamDetected) {
            if (enemy && enemy.skill && enemy.skill.type === "teleport" && enemy.skill.remainingCooldownFrames >= 37 && !visible) {
                G_History.isAmbushStreamDetected = true;
            }
        }
        if (G_History.cloakFramesLeft > 0) {
            G_History.cloakFramesLeft--;
        }
        if (enemy && enemy.status && enemy.status.cloaked) {
            G_History.cloakFramesLeft = 8;
        }
        if (enemy && enemy.status && enemy.status.overloaded) {
            G_History.lastEnemyOverloadedFrame = G_History.frame;
        }
        G_History.wasEnemyVisible = G_History.lastEnemyVisible;
        G_History.lastEnemyVisible = visible;
        if (visible) {
            G_History.lastEnemyPos = eTank.position; G_History.lastEnemyDir = eTank.direction; G_History.lastEnemySeenFrame = G_History.frame;
            G_History.isEnemyPosPredicted = false;
            G_History.invalidPredictedSpots = {};
            G_History.firedPredictedSpots = {};
            if (enemy && enemy.skill && enemy.skill.type === "teleport" && enemy.skill.remainingCooldownFrames >= 38) {
                if (G_History.enemyTeleportRevealedFrame !== G_History.frame - 1 && G_History.enemyTeleportRevealedFrame !== G_History.frame) {
                }
                G_History.enemyTeleportRevealedFrame = G_History.frame;
            }
        } else if (enemy && enemy.skill && enemy.skill.type === "teleport" && enemy.skill.remainingCooldownFrames >= 38 && G_History.isAmbushStreamDetected) {
            var alreadyRevealedThisCycle = G_History.enemyTeleportRevealedFrame && (G_History.frame - G_History.enemyTeleportRevealedFrame <= 3);
            if (!alreadyRevealedThisCycle) {
                G_History.invalidPredictedSpots = {};
                G_History.firedPredictedSpots = {};
                var ambushSpot = findAmbushGrassTile(game.star, game.map, false);
                if (ambushSpot) {
                    G_History.lastEnemyPos = ambushSpot.pos;
                    G_History.lastEnemyDir = ambushSpot.dir;
                    G_History.lastEnemySeenFrame = G_History.frame;
                    G_History.isEnemyPosPredicted = true;
                }
            }
        }
        G_History.lastUpdatedFrame = G_History.frame;
    }
    var unsafeCoAxialTiles = {};
    var limit = G_Blueprint.Tactics.STANCE === "ANTI_CLOAK" ? 60 : 55;
    var skipCoAxial = G_History.isEnemyPosPredicted;
    if (!skipCoAxial && !visible && G_History.lastEnemyPos && (G_History.frame - G_History.lastEnemySeenFrame < limit)) {
        var lastSeen = G_History.lastEnemyPos;
        var elapsed = G_History.frame - G_History.lastEnemySeenFrame;
        var maxDist = Math.min(5, elapsed + 1);
        var maxRayLen = Math.max(6, (G_Blueprint.Tactics.DANGER_RADIUS || 4) + 2);
        var potentialGrass = [];
        var list = G_Blueprint.mapVision.grassList || [];
        for (var i = 0; i < list.length; i++) {
            var g = list[i];
            if (samePos(g, myPos)) continue;
            var dist = Math.abs(g[0] - lastSeen[0]) + Math.abs(g[1] - lastSeen[1]);
            if (dist <= maxDist) {
                potentialGrass.push(g);
            }
        }
        var dirs = ["up", "down", "left", "right"];
        var hasOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
        for (var i = 0; i < potentialGrass.length; i++) {
            var g = potentialGrass[i];
            for (var j = 0; j < dirs.length; j++) {
                var dirStr = dirs[j];
                var d = delta(dirStr);
                var p = [g[0] + d[0], g[1] + d[1]];
                var safety = 0;
                while (safety < maxRayLen) {
                    var tile = getTile(p, game.map);
                    if (!tile || tile === "x" || tile === "m") break;
                    if (tile !== "o") {
                        unsafeCoAxialTiles[p[0] + "," + p[1]] = true;
                    }
                    p = [p[0] + d[0], p[1] + d[1]];
                    safety++;
                }
                if (hasOverload) {
                    var rightDir = overloadRightDir(dirStr);
                    var rDelta = delta(rightDir);
                    var offsetOrigin = [g[0] + rDelta[0], g[1] + rDelta[1]];
                    var p2 = [offsetOrigin[0] + d[0], offsetOrigin[1] + d[1]];
                    var safety2 = 0;
                    while (safety2 < maxRayLen) {
                        var tile2 = getTile(p2, game.map);
                        if (!tile2 || tile2 === "x" || tile2 === "m") break;
                        if (tile2 !== "o") {
                            unsafeCoAxialTiles[p2[0] + "," + p2[1]] = true;
                        }
                        p2 = [p2[0] + d[0], p2[1] + d[1]];
                        safety2++;
                    }
                }
            }
        }
    }
    var isTeleportAmbushStream = G_History.isAmbushStreamDetected && G_History.enemyInvisibleFrames >= 5;
    var currentEnemyPos = G_History.lastEnemyPos ? G_History.lastEnemyPos.slice() : null;
    var currentEnemyDir = G_History.lastEnemyDir;
    if (!visible && G_History.enemyInvisibleFrames === 1 && currentEnemyPos && currentEnemyDir && !G_History.isEnemyPosPredicted) {
        var isCloakTank = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.skillType === "cloak";
        if (!isCloakTank) {
            var stepDelta = delta(currentEnemyDir);
            var stepTarget = addPos(currentEnemyPos, stepDelta);
            var stepTile = getTile(stepTarget, game.map);
            if (stepTile === "o") {
                currentEnemyPos = stepTarget;
            }
        }
    }
    var predictedEnemyPos = currentEnemyPos ? currentEnemyPos.slice() : null;
    var predictedEnemyDir = currentEnemyDir;
    if (!visible && currentEnemyPos && game.star) {
        var invisibleFrames = G_History.enemyInvisibleFrames;
        if (invisibleFrames > 0 && invisibleFrames <= 30) {
            var enemySpeed = 1;
            if (enemy && enemy.skill && enemy.skill.type === "boost") {
                var isEnemyBoosted = enemy.status && enemy.status.boosted;
                var isEnemyBoostReady = enemy.skill.remainingCooldownFrames === 0;
                if (isEnemyBoosted || isEnemyBoostReady) {
                    enemySpeed = 2;
                }
            }
            var totalSteps = invisibleFrames * enemySpeed;
            var tempPos = currentEnemyPos.slice();
            for (var step = 0; step < totalSteps; step++) {
                if (samePos(tempPos, game.star)) break;
                var nextDir = directionTo(tempPos, game.star);
                var d = delta(nextDir);
                tempPos = [tempPos[0] + d[0], tempPos[1] + d[1]];
                predictedEnemyDir = nextDir;
            }
            predictedEnemyPos = tempPos;
        }
    }
    if (!visible && currentEnemyPos) {
        var invisibleFrames = G_History.enemyInvisibleFrames;
        var enemyInGrass = G_Blueprint.mapVision && G_Blueprint.mapVision.grass[currentEnemyPos[0] + "," + currentEnemyPos[1]];
        if (invisibleFrames >= 8 && enemyInGrass) {
            currentEnemyDir = directionTo(currentEnemyPos, me.tank.position);
        }
    }
    var shootingEnemyPos = currentEnemyPos;
    if (G_History.isEnemyPosPredicted && G_History.lastEnemyPos) {
        var spotKey = G_History.lastEnemyPos[0] + "," + G_History.lastEnemyPos[1];
        if (G_History.firedPredictedSpots && G_History.firedPredictedSpots[spotKey]) {
            var altAmbush = findAmbushGrassTile(game.star, game.map, true);
            if (altAmbush) {
                shootingEnemyPos = altAmbush.pos;
            } else {
                shootingEnemyPos = null;
            }
        }
    }
    var isEnemyRecentlyInvisibleInGrass = G_History.enemyInvisibleFrames > 0 &&
        G_History.enemyInvisibleFrames <= CONFIG.BLIND_FIRE_FRAMES &&
        shootingEnemyPos &&
        isNearGrass(shootingEnemyPos);
    if (enemy && typeof enemy.stars === 'number') {
        var oldEnemyStars = G_History.lastEnemyStars || 0;
        G_History.lastEnemyStars = Math.max(oldEnemyStars, enemy.stars);
        if (G_History.lastEnemyStars > oldEnemyStars) {
        }
    }
    var enemyStars = G_History.lastEnemyStars || 0;
    if (G_History.lastSpokenMeStars === undefined) G_History.lastSpokenMeStars = 0;
    if (me.stars > G_History.lastSpokenMeStars) {
        G_History.lastSpokenMeStars = me.stars;
    }
    return {
        me: me, myPos: me.tank.position, myDir: me.tank.direction, meStars: me.stars, meStatus: me.status || {},
        enemy: enemy, enemyPos: currentEnemyPos, predictedEnemyPos: predictedEnemyPos, shootingEnemyPos: shootingEnemyPos, enemyDir: currentEnemyDir, enemyVisible: visible,
        wasEnemyVisible: G_History.wasEnemyVisible,
        enemyCloaked: G_History.cloakFramesLeft > 0,
        enemySkillReady: enemy && enemy.skill && enemy.skill.remainingCooldownFrames <= 2,
        enemyFireLocked: enemy && enemy.status && enemy.status.fireLocked,
        enemyShielded: enemy && enemy.status && enemy.status.shielded,
        enemyBullet: enemy ? enemy.bullet : null, starPos: game.star, map: game.map,
        canTeleport: me.skill && me.skill.remainingCooldownFrames === 0,
        unsafeCoAxialTiles: unsafeCoAxialTiles,
        isTeleportAmbushStream: isTeleportAmbushStream,
        isEnemyRecentlyInvisibleInGrass: isEnemyRecentlyInvisibleInGrass,
        enemyStars: enemyStars,
        isUrgentStarGrab: (G_History.frame >= 124) && (me.stars <= enemyStars)
    };
}
function tacticalAnalysis(ctx) {
    var rawCandidates = [];
    if (ctx.canTeleport) {
        if (G_Blueprint.Tactics.STANCE === "ANTI_CLOAK") rawCandidates.push(evalPanicTeleport(ctx));
    }
    rawCandidates.push(evalShooting(ctx));
    rawCandidates.push(evalPreAim(ctx));
    rawCandidates.push(evalStarCollection(ctx));
    rawCandidates.push(evalStarGuard(ctx));
    if (G_Blueprint.Tactics.ENABLE_ASSASSINATION) {
        rawCandidates.push(evalAssassination(ctx));
    }
    rawCandidates.push(evalPathAmbushFire(ctx));
    rawCandidates.push(evalGrassAmbushAndSurvival(ctx));
    var candidates = [];
    for (var i = 0; i < rawCandidates.length; i++) {
        if (rawCandidates[i] !== null && rawCandidates[i] !== undefined) {
            candidates.push(rawCandidates[i]);
        }
    }
    if (candidates.length === 0) return null;
    candidates.sort(function (a, b) { return b.score - a.score; });
    return candidates[0];
}
function evalPanicTeleport(ctx) {
    if (ctx.enemyCloaked && !isSafeForAntiCloak(ctx.myPos, ctx)) {
        var esc = findSafeGrassSpot(ctx) || findSafeQuadrantSpot(ctx);
        if (esc && !samePos(esc, ctx.myPos) && isTeleportPassable(esc, ctx)) return { action: "teleport", target: esc, score: 99999 };
    }
    return null;
}
function getUnifiedAssassinSpot(ctx) {
    if (ctx._cachedAssassinSpot !== undefined) {
        return ctx._cachedAssassinSpot;
    }
    if (!ctx.enemyPos || (ctx.enemy && ctx.enemy.status && ctx.enemy.status.shielded)) {
        return ctx._cachedAssassinSpot = null;
    }
    if (ctx.enemyCloaked && !ctx.enemyFireLocked) {
        return ctx._cachedAssassinSpot = null;
    }
    if (ctx.me.bullet || ctx.meStatus.fireLocked) {
        return ctx._cachedAssassinSpot = null;
    }
    var isTeleportAmbushStream = G_History.isAmbushStreamDetected && G_History.enemyInvisibleFrames >= 5;
    var isEnemyAmbushing = !ctx.enemyVisible && ctx.enemy && ctx.enemy.skill && ctx.enemy.skill.type === "teleport" && ctx.enemy.skill.remainingCooldownFrames > 0;
    var shouldAttempt = isTeleportAmbushStream ||
        isEnemyAmbushing ||
        (ctx.meStars <= ctx.enemyStars - 2 && !ctx.enemySkillReady);
    if (!shouldAttempt) {
        return ctx._cachedAssassinSpot = null;
    }
    if ((isTeleportAmbushStream || isEnemyAmbushing) && ctx.enemyPos) {
        var enemyInGrass = G_Blueprint.mapVision && G_Blueprint.mapVision.grass[ctx.enemyPos[0] + "," + ctx.enemyPos[1]];
        if (!enemyInGrass) {
            return ctx._cachedAssassinSpot = null;
        }
    }
    var spot = findAssassinSpot(ctx);
    if (spot && !samePos(spot, ctx.myPos) && isTeleportPassable(spot, ctx) && isSafeForStarTeleport(spot, ctx, true)) {
        return ctx._cachedAssassinSpot = spot;
    }
    return ctx._cachedAssassinSpot = null;
}
function evalAssassination(ctx) {
    var cooldown = ctx.me.skill ? ctx.me.skill.remainingCooldownFrames : 99;
    var state = null;
    if (cooldown === 0) {
        state = "tp";
    } else if (cooldown === 1) {
        state = "pre_aim";
    }
    if (!state) return null;
    var spot = getUnifiedAssassinSpot(ctx);
    if (spot) {
        var fireDir = directionTo(spot, ctx.enemyPos);
        if (state === "tp") {
            if (ctx.myDir !== fireDir) {
                return { action: "turn", target: addPos(ctx.myPos, delta(fireDir)), score: CONFIG.KILL_PRIO + 100, type: "assassinate" };
            }
            if (ctx.canTeleport) {
                return { action: "teleport", target: spot, score: CONFIG.KILL_PRIO + 100, type: "assassinate" };
            }
        } else if (state === "pre_aim") {
            if (ctx.myDir !== fireDir) {
                return { action: "turn", target: addPos(ctx.myPos, delta(fireDir)), score: CONFIG.KILL_PRIO - 50, type: "assassinate" };
            }
        }
    }
    return null;
}
function evalShooting(ctx) {
    var targetVisible = ctx.enemyVisible || ctx.isTeleportAmbushStream;
    if (!ctx.shootingEnemyPos || !targetVisible) return null;
    var cs = canShoot(ctx.myPos, ctx.shootingEnemyPos, ctx.map);
    var canKill = (cs === true || (cs === "mound" && getDist(ctx.myPos, ctx.shootingEnemyPos) <= 7));
    if (canKill) {
        if (ctx.enemyShielded) return null;
        var dir = directionTo(ctx.myPos, ctx.shootingEnemyPos);
        if (ctx.myDir === dir) {
            var isPostTeleportLocked = (G_History.frame - G_History.lastTeleportFrame <= 2);
            if (isPostTeleportLocked && ctx.meStatus.fireLocked) {
                return { action: "move", target: ctx.myPos, score: CONFIG.KILL_PRIO - 80, type: "shoot" };
            }
        } else {
            var onEnemyAxis = (ctx.myPos[0] === ctx.shootingEnemyPos[0] || ctx.myPos[1] === ctx.shootingEnemyPos[1]);
            if (onEnemyAxis && !ctx.enemyFireLocked) {
                var dist = getDist(ctx.myPos, ctx.shootingEnemyPos);
                var isLoSDanger = isLoS(ctx.shootingEnemyPos, ctx.myPos, ctx.enemyDir, ctx.map);
                var isCloseDanger = dist <= 8 && canShoot(ctx.shootingEnemyPos, ctx.myPos, ctx.map) === true && !ctx.enemyVisible;
                var isControlDanger = (G_Blueprint.Tactics.STANCE === "ANTI_CONTROL") && ctx.enemySkillReady && dist <= G_Blueprint.Tactics.DANGER_RADIUS;
                if (isLoSDanger || isCloseDanger || isControlDanger) {
                    return null;
                }
            }
            if (ctx.meStars < ctx.enemyStars && !ctx.canTeleport) {
                return null;
            }
            return { action: "turn", target: ctx.shootingEnemyPos, score: CONFIG.KILL_PRIO - 100, type: "shoot" };
        }
    }
    return null;
}
function evalPreAim(ctx) {
    if (evalPathAmbushFire(ctx)) {
        return null;
    }
    if (G_History.preAimLockoutUntil && G_History.frame < G_History.preAimLockoutUntil) {
        return null;
    }
    var isEnemyOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
    if (isEnemyOverload && ctx.enemyPos) {
        var d = getDist(ctx.myPos, ctx.enemyPos);
        if (d <= 5 && (ctx.myPos[0] > ctx.enemyPos[0] || ctx.myPos[1] > ctx.enemyPos[1])) {
            return null;
        }
    }
    var targetVisible = ctx.enemyVisible || ctx.isEnemyRecentlyInvisibleInGrass || ctx.isTeleportAmbushStream;
    if (!ctx.shootingEnemyPos || !targetVisible || !ctx.enemyDir) {
        G_History.preAimTicks = 0;
        G_History.preAimDir = null;
        return null;
    }
    var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
    var recentlyTeleported = G_History.postTeleportFrames > 0;
    if (isCurrentlyInGrass || recentlyTeleported) {
        if (recentlyTeleported) {
            if (ctx.starPos && getDist(ctx.myPos, ctx.starPos) === 1) {
                return null;
            }
        }
        var preAimDir = findPreAimDir(ctx.myPos, ctx.shootingEnemyPos, ctx.enemyDir, ctx.map);
        if (preAimDir) {
            var maxWaitTicks = 10;
            if (ctx.meStars > ctx.enemyStars) {
                maxWaitTicks = 20;
            }
            if (G_History.preAimDir === preAimDir && G_History.preAimTicks > maxWaitTicks) {
                G_History.preAimLockoutUntil = G_History.frame + 15;
                G_History.preAimTicks = 0;
                G_History.preAimDir = null;
                return null;
            }
            if (ctx.myDir !== preAimDir) {
                return { action: "turn", target: addPos(ctx.myPos, delta(preAimDir)), score: CONFIG.KILL_PRIO - 150, type: "pre_aim" };
            } else {
                if (G_History.preAimDir !== preAimDir) {
                    G_History.preAimDir = preAimDir;
                    G_History.preAimTicks = 1;
                } else {
                    G_History.preAimTicks++;
                }
                return { action: "move", target: ctx.myPos, score: CONFIG.KILL_PRIO - 160, type: "pre_aim" };
            }
        }
    }
    G_History.preAimTicks = 0;
    G_History.preAimDir = null;
    return null;
}
function evalStarCollection(ctx) {
    if (!ctx.starPos) return null;
    var dist = getDist(ctx.myPos, ctx.starPos);
    var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
    var shouldStayAmbush = ctx.enemyVisible || ctx.isEnemyRecentlyInvisibleInGrass;
    if (isCurrentlyInGrass && ctx.shootingEnemyPos && ctx.enemyDir && shouldStayAmbush) {
        var preAimDir = findPreAimDir(ctx.myPos, ctx.shootingEnemyPos, ctx.enemyDir, ctx.map);
        if (preAimDir && ctx.myDir === preAimDir) {
            if (dist > 1) return null;
        }
    }
    var score = CONFIG.STAR_PRIO - dist;
    if (G_History.frame < 80) score += 600;
    if (ctx.enemy && ctx.meStars <= ctx.enemy.stars) score += 400;
    if (G_History.lastActionType === "star") {
        score += 150;
    }
    var isEnemyTeleport = ctx.enemy && ctx.enemy.skill && ctx.enemy.skill.type === "teleport";
    var isMyPosAt2_2 = samePos(ctx.myPos, [2, 2]);
    var forbidEarlyTP = isEnemyTeleport && G_History.frame <= 6 && !isMyPosAt2_2;
    if (G_History.frame - G_History.starTeleportFrame === 1) {
        if (dist === 1) {
            var dirToStar = directionTo(ctx.myPos, ctx.starPos);
            if (ctx.myDir === dirToStar) {
                return { action: "move", target: ctx.myPos, score: CONFIG.STAR_PRIO + 500, type: "star" };
            } else {
                return { action: "turn", target: ctx.starPos, score: CONFIG.STAR_PRIO + 500, type: "star" };
            }
        }
    }
    var isFinalStageLeading = (G_History.frame >= 100) && (ctx.meStars > ctx.enemyStars);
    var minTeleportDist = ctx.isUrgentStarGrab ? 2 : 7;
    if (ctx.canTeleport && (ctx.isUrgentStarGrab || (dist > minTeleportDist && !forbidEarlyTP && !isFinalStageLeading))) {
        var teleportTarget = findBestStarTeleportTarget(ctx);
        if (teleportTarget && !samePos(teleportTarget, ctx.myPos) && isTeleportPassable(teleportTarget, ctx)) {
            var teleportScore = ctx.isUrgentStarGrab ? 20000 : (CONFIG.STAR_PRIO + 1000);
            return { action: "teleport", target: teleportTarget, score: teleportScore, type: "star" };
        }
    }
    var cdRemaining = ctx.me.skill && ctx.me.skill.remainingCooldownFrames;
    var newlyTeleported = cdRemaining && (40 - cdRemaining >= 1 && 40 - cdRemaining <= 4);
    var isUrgentAndLosing = ctx.isUrgentStarGrab && (ctx.meStars < ctx.enemyStars);
    var isLastWalking = (G_History.frame >= 126 && ctx.meStars <= ctx.enemyStars && getDist(ctx.myPos, ctx.starPos) === 2);
    var nextStep = getNextStep(ctx.myPos, ctx.starPos, ctx) || ctx.starPos;
    var safeForWalking = true;
    if ((newlyTeleported && isUrgentAndLosing) || isLastWalking) {
        score = 25000;
    } else {
        safeForWalking = isSafeForStarWalking(nextStep, ctx);
        if (safeForWalking && G_History.recentDodgeSource) {
            var nextKey = nextStep[0] + "," + nextStep[1];
            var reflexFrame = G_History.recentDodgeSource[nextKey];
            if (reflexFrame !== undefined && (G_History.frame - reflexFrame <= 3)) {
                safeForWalking = false;
            }
        }
        if (safeForWalking && ctx.enemyBullet) {
            var needTurn = (directionTo(ctx.myPos, nextStep) !== ctx.myDir);
            if (needTurn) {
                var bulletFH = getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map);
                if (bulletFH !== Infinity && bulletFH <= 2) {
                    safeForWalking = false;
                }
            }
        }
        if (!safeForWalking) score = Math.min(score - 1200, -500);
    }
    return { action: "move", target: ctx.starPos, score: score, type: "star" };
}
function evalStarGuard(ctx) {
    if (!ctx.starPos) return null;
    if (!isSafe(ctx.myPos, ctx, true)) return null;
    var safeForWalking = isSafeForStarWalking(ctx.starPos, ctx);
    var hasSafeTeleportTarget = false;
    if (ctx.canTeleport && getDist(ctx.myPos, ctx.starPos) > 7) {
        if (findBestStarTeleportTarget(ctx)) {
            hasSafeTeleportTarget = true;
        }
    }
    if (safeForWalking || hasSafeTeleportTarget) return null;
    var onAxis = (ctx.myPos[0] === ctx.starPos[0] || ctx.myPos[1] === ctx.starPos[1]);
    if (!onAxis) return null;
    if (canShoot(ctx.myPos, ctx.starPos, ctx.map) === false) return null;
    var scoreBonus = (G_History.lastActionType === "guard") ? 150 : 0;
    if (ctx.enemyPos && getDist(ctx.myPos, ctx.enemyPos) === 1) {
        var dirToStar = directionTo(ctx.myPos, ctx.starPos);
        var revDir = reverseDir(dirToStar);
        var escapePos = addPos(ctx.myPos, delta(revDir));
        if (isPassable(escapePos, ctx.map)) {
            return { action: "move", target: escapePos, score: 23000, type: "guard" };
        }
    }
    if (!ctx.me.bullet && !ctx.meStatus.fireLocked) {
        var dirToStar = directionTo(ctx.myPos, ctx.starPos);
        if (ctx.myDir === dirToStar) {
            var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
            if (!isCurrentlyInGrass) {
                return { action: "fire", target: ctx.starPos, score: 2200 + scoreBonus, type: "guard" };
            }
        } else {
            return { action: "turn", target: ctx.starPos, score: 2200 + scoreBonus, type: "guard" };
        }
    }
    return null;
}
function getEnemyPredictedPath(enemyPos, enemyDir, starPos, map) {
    var tempPos = enemyPos.slice();
    var currentDir = enemyDir;
    var path = [];
    var safety = 0;
    var maxSteps = 15;
    while (safety < maxSteps) {
        if (starPos && samePos(tempPos, starPos)) {
            break;
        }
        var nextDir = currentDir;
        var d = delta(nextDir);
        var testPos = [tempPos[0] + d[0], tempPos[1] + d[1]];
        var tile = getTile(testPos, map);
        var isBlocked = !tile || tile === "x" || tile === "m";
        var needTurn = false;
        if (starPos) {
            var distCurrent = getDist(tempPos, starPos);
            var distTest = getDist(testPos, starPos);
            if (distTest > distCurrent) {
                needTurn = true;
            }
        }
        if (isBlocked || needTurn) {
            if (starPos) {
                nextDir = directionTo(tempPos, starPos);
                var d2 = delta(nextDir);
                var testPos2 = [tempPos[0] + d2[0], tempPos[1] + d2[1]];
                var tile2 = getTile(testPos2, map);
                if (!tile2 || tile2 === "x" || tile2 === "m") {
                    break;
                }
            } else {
                break;
            }
        }
        var stepDelta = delta(nextDir);
        tempPos = [tempPos[0] + stepDelta[0], tempPos[1] + stepDelta[1]];
        currentDir = nextDir;
        path.push({ pos: tempPos.slice(), dir: currentDir, step: path.length + 1 });
        safety++;
    }
    return path;
}
function findPathAmbushSpot(enemyPath, myPos, starPos, map, ctx) {
    var list = G_Blueprint.mapVision.grassList || [];
    var bestSpot = null;
    var bestScore = -9999;
    var enemySpeed = 1;
    if (ctx.enemy && ctx.enemy.skill && ctx.enemy.skill.type === "boost") {
        var isEnemyBoosted = ctx.enemy.status && ctx.enemy.status.boosted;
        var isEnemyBoostReady = ctx.enemy.skill.remainingCooldownFrames === 0;
        if (isEnemyBoosted || isEnemyBoostReady) {
            enemySpeed = 2;
        }
    }
    for (var i = 0; i < enemyPath.length; i++) {
        var node = enemyPath[i];
        for (var j = 0; j < list.length; j++) {
            var g = list[j];
            var gKey = g[0] + "," + g[1];
            if (G_History.invalidPredictedSpots && G_History.invalidPredictedSpots[gKey]) continue;
            if (starPos && samePos(g, starPos)) continue;
            var d = getDist(g, node.pos);
            if (d >= 3 && d <= 7) {
                var dir = directionTo(g, node.pos);
                var isCoAxial = (g[0] === node.pos[0] || g[1] === node.pos[1]);
                var hasLoS = isCoAxial && isLoS(g, node.pos, dir, map);
                if (hasLoS) {
                    var isEnemyOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
                    if (isEnemyOverload) {
                        var relativeLeft = (g[0] < node.pos[0]) && (g[1] === node.pos[1]);
                        var relativeUp = (g[1] < node.pos[1]) && (g[0] === node.pos[0]);
                        if (!relativeLeft && !relativeUp) continue;
                        if (ctx.enemyPos) {
                            if (g[0] > ctx.enemyPos[0] || g[1] > ctx.enemyPos[1]) continue;
                        }
                    }
                    var timeToAmbush = samePos(myPos, g) ? 0 : (ctx.canTeleport ? 1 : getDist(myPos, g));
                    var enemyTimeToTarget = Math.ceil(node.step / enemySpeed);
                    if (enemyTimeToTarget < timeToAmbush) continue;
                    var score = 1000 - d * 20 - getDist(myPos, g) * 10 - node.step * 5;
                    if (isSafe(g, ctx, true)) score += 300;
                    if (score > bestScore) {
                        bestScore = score;
                        bestSpot = {
                            pos: g,
                            dir: dir,
                            targetPos: node.pos,
                            targetDir: node.dir,
                            step: node.step
                        };
                    }
                }
            }
        }
    }
    return bestSpot;
}
function evalPathAmbush(ctx) {
    if (!ctx.starPos || !ctx.enemyPos || !ctx.enemy) return null;
    if (G_Blueprint.enemyProfile && (G_Blueprint.enemyProfile.hasOverload || G_Blueprint.enemyProfile.skillType == "teleport")) return null;
    var advantage = ctx.meStars >= (ctx.enemyStars + 2);
    if (!advantage) return null;
    var enemyPath = getEnemyPredictedPath(ctx.enemyPos, ctx.enemyDir, ctx.starPos, ctx.map);
    if (enemyPath.length === 0) return null;
    var ambushSpot = findPathAmbushSpot(enemyPath, ctx.myPos, ctx.starPos, ctx.map, ctx);
    if (!ambushSpot) return null;
    var dist = getDist(ctx.myPos, ambushSpot.pos);
    if (!samePos(ctx.myPos, ambushSpot.pos)) {
        if (ctx.canTeleport && dist > 1) {
            if (isTeleportPassable(ambushSpot.pos, ctx) && isSafeForStarTeleport(ambushSpot.pos, ctx, false)) {
                return { action: "teleport", target: ambushSpot.pos, score: 2100, type: "ambush" };
            }
        }
        if (isSafe(ambushSpot.pos, ctx, true)) {
            return { action: "move", target: ambushSpot.pos, score: 1800 - dist, type: "ambush" };
        }
    } else {
        if (ctx.myDir !== ambushSpot.dir) {
            return { action: "turn", target: ambushSpot.targetPos, score: 1900, type: "ambush" };
        }
        return { action: "move", target: ctx.myPos, score: 1850, type: "ambush" };
    }
    return null;
}
function evalPathAmbushFire(ctx) {
    if (ctx._cachedPathAmbushFire !== undefined) {
        return ctx._cachedPathAmbushFire;
    }
    var result = (function () {
        if (!ctx.enemyPos || !ctx.enemy) return null;
        var isEnemyOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
        if (isEnemyOverload && ctx.enemyPos) {
            var d = getDist(ctx.myPos, ctx.enemyPos);
            if (d <= 5 && (ctx.myPos[0] > ctx.enemyPos[0] || ctx.myPos[1] > ctx.enemyPos[1])) {
                return null;
            }
        }
        var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
        if (!isCurrentlyInGrass) return null;
        var startPos = ctx.enemyVisible ? ctx.enemyPos : (ctx.predictedEnemyPos || ctx.enemyPos);
        var enemyPath = getEnemyPredictedPath(startPos, ctx.enemyDir, ctx.starPos, ctx.map);
        if (enemyPath.length === 0) return null;
        var bestInterception = null;
        for (var i = 0; i < enemyPath.length; i++) {
            var node = enemyPath[i];
            if (ctx.starPos && samePos(ctx.myPos, ctx.starPos)) continue;
            var d = getDist(ctx.myPos, node.pos);
            var isStarAmbush = ctx.starPos && (getDist(node.pos, ctx.starPos) <= 1);
            var minD = isStarAmbush ? 1 : 3;
            if (d < minD || d > 7) continue;
            var dir = directionTo(ctx.myPos, node.pos);
            var isCoAxial = (ctx.myPos[0] === node.pos[0] || ctx.myPos[1] === node.pos[1]);
            if (!isCoAxial) continue;
            if (isLoS(ctx.myPos, node.pos, dir, ctx.map) === false) continue;
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
            if (ctx.enemyDir && node.dir) {
                if (ctx.enemyDir !== node.dir) {
                    T_enemy += 1;
                }
            }
            var isEnemyCoAxialWithUs = (ctx.enemyPos[0] === ctx.myPos[0] || ctx.enemyPos[1] === ctx.myPos[1]);
            var shouldFire = false;
            if (isEnemyCoAxialWithUs) {
                var dirToTargetFromEnemy = directionTo(ctx.enemyPos, node.pos);
                if (ctx.enemyDir === dirToTargetFromEnemy) {
                    if (T_enemy >= T_bullet) {
                        shouldFire = true;
                    }
                }
            } else {
                if (T_enemy === T_bullet) {
                    shouldFire = true;
                }
            }
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
            if (!ctx.me.bullet && !ctx.meStatus.fireLocked) {
                return { action: "fire", target: bestInterception.targetPos, score: 2200, type: "ambush_fire" };
            }
        }
        return null;
    })();
    ctx._cachedPathAmbushFire = result;
    return result;
}
function evalGrassAmbushAndSurvival(ctx) {
    var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
    var grass = findNearestSafeGrass(ctx.myPos, ctx);
    if (grass) {
        var starUnsafe = ctx.starPos && !isSafeForStarWalking(ctx.starPos, ctx);
        var score = 300;
        if (isCurrentlyInGrass && (!ctx.starPos || starUnsafe)) {
            var overloadNearby = ctx.enemyPos && isEnemyOverloadActive(ctx, ctx.myPos) && getDist(ctx.myPos, ctx.enemyPos) <= 4;
            if (overloadNearby && isOnEnemyGunLine(ctx.myPos, ctx, true)) {
            } else {
                var isCoAxialWithStar = ctx.starPos && (ctx.myPos[0] === ctx.starPos[0] || ctx.myPos[1] === ctx.starPos[1]);
                if (G_History.lastGrassEntrancePos && !G_History.hasShiftedInGrass && samePos(ctx.myPos, G_History.lastGrassEntrancePos) && !isCoAxialWithStar) {
                    var dirs = ["up", "right", "down", "left"];
                    var bestShiftTarget = null;
                    var maxDDist = -1;
                    for (var i = 0; i < dirs.length; i++) {
                        var nextPos = addPos(ctx.myPos, delta(dirs[i]));
                        if (isPassable(nextPos, ctx.map)) {
                            var isNextGrass = G_Blueprint.mapVision.grass[nextPos[0] + "," + nextPos[1]];
                            if (isNextGrass && isSafe(nextPos, ctx, true)) {
                                var distToEnemy = ctx.enemyPos ? getDist(nextPos, ctx.enemyPos) : 999;
                                if (distToEnemy > maxDDist) {
                                    maxDDist = distToEnemy;
                                    bestShiftTarget = nextPos;
                                }
                            }
                        }
                    }
                    if (bestShiftTarget) {
                        return { action: "move", target: bestShiftTarget, score: score + 100, type: "survival" };
                    }
                }
                if (ctx.enemyPos && getDist(ctx.myPos, ctx.enemyPos) <= 8 && ctx.enemyVisible) {
                    var d = directionTo(ctx.myPos, ctx.enemyPos);
                    if (ctx.myDir !== d) {
                        return { action: "turn", target: ctx.enemyPos, score: score + 50, type: "survival" };
                    }
                }
                return { action: "move", target: ctx.myPos, score: score, type: "survival" };
            }
        }
        score = 250 - getDist(ctx.myPos, grass) * 10;
        if (!ctx.starPos || starUnsafe) score += 550;
        if (G_History.lastActionType === "survival") {
            score += (!isCurrentlyInGrass) ? 800 : 150;
        }
        return { action: "move", target: grass, score: score, type: "survival" };
    }
    var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx) || [9, 7];
    var fallbackScore = 100;
    if (G_History.lastActionType === "survival") {
        fallbackScore += (!isCurrentlyInGrass) ? 800 : 150;
    }
    return { action: "move", target: esc, score: fallbackScore, type: "survival" };
}
function tacticalDefense(me, ctx) {
    if (ctx.starPos && getDist(ctx.myPos, ctx.starPos) === 1) {
        var dirToStar = directionTo(ctx.myPos, ctx.starPos);
        if (ctx.myDir === dirToStar && isSafeForStarWalking(ctx.starPos, ctx)) {
            if (!ctx.enemyBullet || getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map) > 1) {
                return null;
            }
        }
    }
    if (ctx.enemyBullet) {
        var keyStr = ctx.myPos[0] + "," + ctx.myPos[1];
        var fH = G_DangerTiles[keyStr] !== undefined ? Math.ceil(G_DangerTiles[keyStr] / 2) : Infinity;
        if (fH <= 5) {
            var dodge = findBestDodge(ctx, fH);
            var needTurn = dodge && (directionTo(ctx.myPos, dodge) !== ctx.myDir);
            var tooClose = fH <= 2 || (fH <= 3 && needTurn);
            if (ctx.canTeleport && (tooClose || !dodge)) {
                var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx);
                if (esc && !samePos(esc, ctx.myPos) && isTeleportPassable(esc, ctx)) {
                    return { action: "teleport", target: esc, score: 99999 };
                }
            }
            if (dodge) { G_History.defenseLockTicks = 2; G_History.lastDefenseTarget = dodge; return { action: "move", target: dodge, score: 99999 }; }
        }
    }
    if (G_History.defenseLockTicks > 0 && G_History.lastDefenseTarget) {
        G_History.defenseLockTicks--;
        if (isSafe(G_History.lastDefenseTarget, ctx, true)) return { action: "move", target: G_History.lastDefenseTarget, score: 30000 };
    }
    if (!ctx.enemyBullet && ctx.enemyPos) {
        var recentlySeen = (G_History.frame - G_History.lastEnemySeenFrame < 6);
        if (recentlySeen || ctx.enemyCloaked) {
            var ghostDist = getDist(ctx.myPos, ctx.enemyPos);
            if (ghostDist <= 7) {
                var myPosInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
                var isEnemyOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
                var enemyReadyClose = isEnemyOverload && ctx.enemySkillReady && ghostDist <= 3;
                var activeOverload = (ctx.enemy && ctx.enemy.status && ctx.enemy.status.overloaded) || enemyReadyClose;
                var needCheckOverload = !myPosInGrass || activeOverload;
                var onEnemyLine = isOnEnemyGunLine(ctx.myPos, ctx, needCheckOverload);
                if (!myPosInGrass || activeOverload || (ghostDist <= 2 && onEnemyLine)) {
                    if (onEnemyLine) {
                        var ghostEscape = findOffAxisMove(ctx);
                        if (ghostEscape) {
                            var needTurn = directionTo(ctx.myPos, ghostEscape.target) !== ctx.myDir;
                            if (needTurn && ctx.canTeleport && getDist(ctx.myPos, ctx.enemyPos) <= 2) {
                                var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx);
                                if (esc && !samePos(esc, ctx.myPos) && isTeleportPassable(esc, ctx)) {
                                    return { action: "teleport", target: esc, score: 99999 };
                                }
                            }
                            ghostEscape.score = 22000;
                            G_History.defenseLockTicks = 2;
                            G_History.lastDefenseTarget = ghostEscape.target;
                            return ghostEscape;
                        }
                    }
                }
            }
        }
    }
    if (!ctx.enemyBullet && ctx.enemyPos && !ctx.enemyVisible) {
        var myPosInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
        if (!myPosInGrass) {
            if (ctx.unsafeCoAxialTiles && ctx.unsafeCoAxialTiles[ctx.myPos[0] + "," + ctx.myPos[1]]) {
                var ghostEscape = findOffAxisMove(ctx);
                if (ghostEscape) {
                    var needTurn = directionTo(ctx.myPos, ghostEscape.target) !== ctx.myDir;
                    if (needTurn && ctx.canTeleport && getDist(ctx.myPos, ctx.enemyPos) <= 2) {
                        var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx);
                        if (esc && !samePos(esc, ctx.myPos) && isTeleportPassable(esc, ctx)) {
                            return { action: "teleport", target: esc, score: 99999 };
                        }
                    }
                    ghostEscape.score = 22000;
                    G_History.defenseLockTicks = 2;
                    G_History.lastDefenseTarget = ghostEscape.target;
                    return ghostEscape;
                }
            }
        }
    }
    var enemySeenRecently = ctx.enemyPos && (G_History.frame - G_History.lastEnemySeenFrame < 35);
    if (ctx.enemyPos && (ctx.enemyVisible || enemySeenRecently) && !ctx.enemyFireLocked) {
        var d = getDist(ctx.myPos, ctx.enemyPos);
        var myPosInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
        var isEnemyOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
        var enemyReadyClose = isEnemyOverload && ctx.enemySkillReady && d <= 3;
        var activeOverload = (ctx.enemy && ctx.enemy.status && ctx.enemy.status.overloaded) || enemyReadyClose;
        var needCheckOverload = !myPosInGrass || activeOverload;
        var onLine = isOnEnemyGunLine(ctx.myPos, ctx, needCheckOverload);
        if (onLine && d <= 8) {
            if (!myPosInGrass || d <= 2 || activeOverload) {
                var escape = findOffAxisMove(ctx);
                if (escape) {
                    var needTurn = directionTo(ctx.myPos, escape.target) !== ctx.myDir;
                    if (needTurn && ctx.canTeleport && getDist(ctx.myPos, ctx.enemyPos) <= 2) {
                        var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx);
                        if (esc && !samePos(esc, ctx.myPos) && isTeleportPassable(esc, ctx)) {
                            return { action: "teleport", target: esc, score: 99999 };
                        }
                    }
                    escape.score = 25000;
                    G_History.defenseLockTicks = 2;
                    G_History.lastDefenseTarget = escape.target;
                    return escape;
                }
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
function isEnemyOverloadActive(ctx, pos) {
    if (!G_Blueprint.enemyProfile || !G_Blueprint.enemyProfile.hasOverload) return false;
    var recentlyOverloaded = G_History.lastEnemyOverloadedFrame && (G_History.frame - G_History.lastEnemyOverloadedFrame < 8);
    return (ctx.enemy && ctx.enemy.status && ctx.enemy.status.overloaded) ||
        (ctx.enemySkillReady) ||
        recentlyOverloaded;
}
function isOnEnemyGunLine(pos, ctx, checkOverload) {
    if (!pos || !ctx.enemyPos || !ctx.enemyDir) return false;
    var cacheKey = pos[0] + "," + pos[1] + "|" + ctx.enemyPos[0] + "," + ctx.enemyPos[1] + "|" + ctx.enemyDir + "|" + (checkOverload ? 1 : 0);
    if (G_OnGunLineCache[cacheKey] !== undefined) return G_OnGunLineCache[cacheKey];
    var res = (function () {
        var d = delta(ctx.enemyDir);
        if (d[0] === 0 && d[1] === 0) return false;
        for (var k = 0; k <= 2; k++) {
            var ePos = [ctx.enemyPos[0] + k * d[0], ctx.enemyPos[1] + k * d[1]];
            if (k > 0 && !isPassable(ePos, ctx.map)) break;
            var mainOrigin = addPos(ePos, d);
            if (isLoS(mainOrigin, pos, ctx.enemyDir, ctx.map)) return true;
            if (checkOverload && isEnemyOverloadActive(ctx, pos)) {
                var rightDir = overloadRightDir(ctx.enemyDir);
                var rightOrigin = addPos(mainOrigin, delta(rightDir));
                if (isLoS(rightOrigin, pos, ctx.enemyDir, ctx.map)) return true;
            }
        }
        return false;
    })();
    G_OnGunLineCache[cacheKey] = res;
    return res;
}
function isSafe(pos, ctx, strict, isAssassinationSpot) {
    if (!pos) return false;
    var cacheKey = pos[0] + "," + pos[1] + "," + (strict ? 1 : 0) + "," + (isAssassinationSpot ? 1 : 0);
    if (G_SafeCache[cacheKey] !== undefined) return G_SafeCache[cacheKey];
    var res = (function () {
        if (ctx.enemyBullet) {
            var keyStr = pos[0] + "," + pos[1];
            var fH = G_DangerTiles[keyStr];
            if (fH !== undefined && fH <= (strict ? 4 : 2)) return false;
        }
        if (ctx.enemyPos) {
            var d = getDist(pos, ctx.enemyPos);
            if (ctx.enemyVisible) {
                var isGrass = G_Blueprint.mapVision.grass[pos[0] + "," + pos[1]];
                var overloadNearby = isEnemyOverloadActive(ctx, pos) && d <= 4;
                var bulletPassable = canShoot(ctx.enemyPos, pos, ctx.map) === true;
                var gunLineDodge = isOnEnemyGunLine(pos, ctx, true) && (!isGrass || overloadNearby || bulletPassable);
                if (gunLineDodge) return false;
                if (strict && ctx.enemySkillReady && d <= G_Blueprint.Tactics.DANGER_RADIUS) return false;
                if (d < 2) return false;
            } else {
                if (isAssassinationSpot) {
                    if (d < 1) return false;
                    if (isOnEnemyGunLine(pos, ctx, true)) return false;
                } else {
                    var limit = G_Blueprint.Tactics.STANCE === "ANTI_CLOAK" ? 50 : 120;
                    var enemySeenRecently = (G_History.frame - G_History.lastEnemySeenFrame < limit);
                    var realEnemyPos = G_History.lastEnemyPos;
                    var dReal = realEnemyPos ? getDist(pos, realEnemyPos) : d;
                    if (dReal <= 2) return false;
                    if (enemySeenRecently) {
                        var inGrass = G_Blueprint.mapVision.grass[pos[0] + "," + pos[1]];
                        if (inGrass && !samePos(pos, ctx.myPos) && realEnemyPos) {
                            var isCoAxial = (pos[0] === realEnemyPos[0] || pos[1] === realEnemyPos[1]);
                            if (isCoAxial && dReal <= 8 && canShoot(realEnemyPos, pos, ctx.map) !== false) {
                                return false;
                            }
                        }
                        if (!inGrass) {
                            if (strict && dReal <= 3) return false;
                            if (realEnemyPos) {
                                var backupPos = ctx.enemyPos;
                                ctx.enemyPos = realEnemyPos;
                                var onGun = isOnEnemyGunLine(pos, ctx, true);
                                ctx.enemyPos = backupPos;
                                if (onGun) return false;
                            }
                            if (realEnemyPos && (pos[0] === realEnemyPos[0] || pos[1] === realEnemyPos[1])) {
                                if (canShoot(realEnemyPos, pos, ctx.map) !== false) return false;
                            }
                            if (ctx.unsafeCoAxialTiles && ctx.unsafeCoAxialTiles[pos[0] + "," + pos[1]]) return false;
                        }
                    }
                }
            }
        }
        return true;
    })();
    G_SafeCache[cacheKey] = res;
    return res;
}
function isSafeForStarTeleport(pos, ctx, isAssassinationSpot) {
    if (ctx.isUrgentStarGrab && ctx.meStars < ctx.enemyStars) {
        if (ctx.enemyPos && getDist(pos, ctx.enemyPos) < 2) return false;
        return true;
    }
    if (!isSafe(pos, ctx, true, isAssassinationSpot)) return false;
    if (ctx.enemyPos) {
        var d = getDist(pos, ctx.enemyPos);
        if (!isAssassinationSpot && d <= 2) return false;
        if (!isAssassinationSpot) {
            if (isOnEnemyGunLine(pos, ctx, true) && !ctx.enemyFireLocked) {
                return false;
            }
            if (d <= 8 && !ctx.enemyFireLocked) {
                var mainOnAxis = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
                if (mainOnAxis && canShoot(ctx.enemyPos, pos, ctx.map) === true) {
                    return false;
                }
                if (isEnemyOverloadActive(ctx, ctx.myPos)) {
                    var isOverloadAxisX = (pos[0] === ctx.enemyPos[0] + 1);
                    var isOverloadAxisY = (pos[1] === ctx.enemyPos[1] + 1);
                    if (isOverloadAxisX && canShoot([ctx.enemyPos[0] + 1, ctx.enemyPos[1]], pos, ctx.map) === true) {
                        return false;
                    }
                    if (isOverloadAxisY && canShoot([ctx.enemyPos[0], ctx.enemyPos[1] + 1], pos, ctx.map) === true) {
                        return false;
                    }
                }
            }
        }
    }
    return true;
}
function getEnemyBulletArrivalTime(pos, ctx) {
    if (!ctx.enemyPos || !ctx.enemyDir) return Infinity;
    var tMin = Infinity;
    var mainOnAxis = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
    if (mainOnAxis && canShoot(ctx.enemyPos, pos, ctx.map) === true) {
        var mainDist = getDist(ctx.enemyPos, pos);
        if (isLoS(ctx.enemyPos, pos, ctx.enemyDir, ctx.map)) {
            tMin = Math.min(tMin, Math.ceil(mainDist / 2));
        } else {
            tMin = Math.min(tMin, 1 + Math.ceil(mainDist / 2));
        }
    }
    if (isEnemyOverloadActive(ctx, ctx.myPos)) {
        var rDir = overloadRightDir(ctx.enemyDir);
        if (rDir) {
            var offsetOrigin = addPos(ctx.enemyPos, delta(rDir));
            var overloadOnAxis = (pos[0] === offsetOrigin[0] || pos[1] === offsetOrigin[1]);
            if (overloadOnAxis && canShoot(offsetOrigin, pos, ctx.map) === true) {
                var overloadDist = getDist(offsetOrigin, pos);
                if (isLoS(offsetOrigin, pos, ctx.enemyDir, ctx.map)) {
                    tMin = Math.min(tMin, Math.ceil(overloadDist / 2));
                } else {
                    tMin = Math.min(tMin, 1 + Math.ceil(overloadDist / 2));
                }
            }
        }
    }
    return tMin;
}
function isSafeForStarWalking(pos, ctx) {
    if (!ctx.enemyPos) return true;
    var enemyPos = ctx.predictedEnemyPos || ctx.enemyPos;
    var myDist = getDist(ctx.myPos, pos);
    var dirToStar = directionTo(ctx.myPos, pos);
    var isFacingStar = (dirToStar === ctx.myDir);
    var canDirectGrab = (myDist === 1 && isFacingStar);
    var strictSafe = isSafe(pos, ctx, true);
    if (!strictSafe) {
        if (canDirectGrab) {
            var isCoAxial = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
            var isEnemyOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
            var isOverloadCoAxial = false;
            if (isEnemyOverload && ctx.enemyDir) {
                var rDir = overloadRightDir(ctx.enemyDir);
                if (rDir) {
                    var offsetPos = addPos(ctx.enemyPos, delta(rDir));
                    isOverloadCoAxial = (pos[0] === offsetPos[0] || pos[1] === offsetPos[1]);
                }
            }
            var enemyDist = getDist(ctx.enemyPos, pos);
            var onDangerousAxis = (isCoAxial || isOverloadCoAxial);
            var isAxisSafe = !onDangerousAxis || (enemyDist > 6);
            if (isAxisSafe) {
                var T_bullet = getEnemyBulletArrivalTime(pos, ctx);
                var bulletFH = getFramesToHit(pos, ctx.enemyBullet, ctx.map);
                if (T_bullet > 1 && enemyDist >= 1 && bulletFH > 1) {
                    return true;
                }
            }
        }
        return false;
    }
    var enemyDist = getDist(enemyPos, pos);
    var T_bullet = getEnemyBulletArrivalTime(pos, ctx);
    var T_me = myDist;
    var requiredBuffer = ctx.canTeleport ? 0 : 1;
    if (T_me + requiredBuffer < T_bullet) {
        if (enemyDist <= 3) return false;
        var bulletFH = getFramesToHit(pos, ctx.enemyBullet, ctx.map);
        if (bulletFH <= T_me) return false;
        return true;
    } else {
        if (T_bullet !== Infinity) {
            if (ctx.meStars >= ctx.enemyStars) {
                return false;
            }
        }
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
    var cacheKey = start[0] + "," + start[1] + "|" + goal[0] + "," + goal[1] + "|" + (ctx.enemyVisible ? 1 : 0);
    if (G_AStarCache[cacheKey] !== undefined) return G_AStarCache[cacheKey];
    var open = [{ pos: start, g: 0, h: getDist(start, goal), path: [], dir: ctx.myDir }], closed = {}, nodes = 0;
    var t = G_Blueprint.Tactics;
    while (open.length > 0 && nodes < t.MAX_NODES) {
        var bestIdx = 0;
        for (var i = 1; i < open.length; i++) {
            if ((open[i].g + open[i].h) < (open[bestIdx].g + open[bestIdx].h)) {
                bestIdx = i;
            }
        }
        var curr = open[bestIdx];
        open.splice(bestIdx, 1);
        if (samePos(curr.pos, goal)) { G_AStarCache[cacheKey] = curr.path; return curr.path; }
        if (closed[key(curr.pos)] && closed[key(curr.pos)] <= curr.g) continue;
        closed[key(curr.pos)] = curr.g; nodes++;
        var dirs = ["up", "right", "down", "left"];
        for (var i = 0; i < dirs.length; i++) {
            var d = dirs[i], next = addPos(curr.pos, delta(d));
            var tile = getTile(next, ctx.map);
            if (tile && tile !== "x") {
                var cost = 1 + (curr.dir === d ? 0 : CONFIG.TURN_COST);
                if (tile === "m") cost += 200;
                if (tile === "o") {
                    var enemyJustTeleported = ctx.enemy && ctx.enemy.skill && ctx.enemy.skill.type === "teleport" && (ctx.enemy.skill.remainingCooldownFrames >= 32);
                    var enemyInvisible = !ctx.enemyVisible;
                    if (enemyJustTeleported && enemyInvisible) {
                        cost += 3000;
                    }
                }
                if (!isSafe(next, ctx, true)) {
                    var isCloseLoS = ctx.enemyVisible && !ctx.enemyFireLocked && ctx.enemyPos &&
                        getDist(next, ctx.enemyPos) <= 5 &&
                        !G_Blueprint.mapVision.grass[next[0] + "," + next[1]] &&
                        isOnEnemyGunLine(next, ctx, true);
                    cost += isCloseLoS ? 9000 : t.ASTAR_UNSAFE_PENALTY;
                }
                if (ctx.enemyBullet && isLoS(ctx.enemyBullet.position, next, ctx.enemyBullet.direction, ctx.map)) {
                    var dOld = getDist(curr.pos, ctx.enemyBullet.position);
                    var dNew = getDist(next, ctx.enemyBullet.position);
                    if (dNew < dOld) cost += 5000;
                    else cost += 1000;
                }
                if (t.STANCE === "ANTI_CLOAK" && !isSafeForAntiCloak(next, ctx)) cost += 2000;
                if (closed[key(next)] !== undefined && closed[key(next)] <= curr.g + cost) {
                    continue;
                }
                var np = curr.path.slice(); np.push(next);
                open.push({ pos: next, g: curr.g + cost, h: getDist(next, goal), path: np, dir: d });
            }
        }
    }
    G_AStarCache[cacheKey] = null;
    return null;
}
function executeAction(me, act, ctx) {
    if (!act) return;
    if (G_History.lastAttemptedStep && G_History.lastPos && samePos(ctx.myPos, G_History.lastPos)) {
        G_History.stuckTurnCount++;
    } else {
        G_History.stuckTurnCount = 0;
    }
    G_History.lastPos = ctx.myPos.slice();
    if (act.type) {
        G_History.lastActionType = act.type;
    }
    if (G_History.stuckTurnCount >= 4 && ctx.canTeleport && ctx.starPos) {
        var target = findBestStarTeleportTarget(ctx);
        if (target && isTeleportPassable(target, ctx)) {
            G_History.stuckTurnCount = 0;
            me.teleport(target[0], target[1]);
            G_History.postTeleportFrames = 8;
            G_History.lastTeleportTarget = target.slice();
            G_History.lastTeleportFrame = G_History.frame;
            G_History.lastTeleportPos = ctx.myPos.slice();
            G_History.starTeleportFrame = G_History.frame;
            return;
        }
    }
    if (act.action === "fire") {
        var d = directionTo(ctx.myPos, act.target);
        if (ctx.myDir === d) { fireGun(me, ctx); } else me.turn(d);
    }
    else if (act.action === "turn") { me.turn(directionTo(ctx.myPos, act.target)); }
    else if (act.action === "teleport") {
        me.teleport(act.target[0], act.target[1]);
        G_History.postTeleportFrames = 8;
        G_History.lastTeleportTarget = act.target.slice();
        G_History.lastTeleportFrame = G_History.frame;
        G_History.lastTeleportPos = ctx.myPos.slice();
        if (ctx.starPos && getDist(act.target, ctx.starPos) === 1) {
            G_History.starTeleportFrame = G_History.frame;
        }
    }
    else if (act.action === "move") {
        var next = getNextStep(ctx.myPos, act.target, ctx);
        if (next) {
            var isCloseLoS = (act.score < 20000) && ctx.enemyVisible && !ctx.enemyFireLocked && ctx.enemyPos &&
                getDist(next, ctx.enemyPos) <= 5 &&
                !G_Blueprint.mapVision.grass[next[0] + "," + next[1]] &&
                isLoS(ctx.enemyPos, next, ctx.enemyDir, ctx.map);
            if (isCloseLoS) {
                G_History.path = [];
                G_History.pathTarget = null;
                return;
            }
            var tile = getTile(next, ctx.map);
            var d = directionTo(ctx.myPos, next);
            if (tile === "m") {
                if (ctx.myDir === d) { fireGun(me, ctx); } else me.turn(d);
            } else {
                if (ctx.myDir === d) {
                    if (G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]]) {
                        G_History.lastLeftGrassPos = ctx.myPos.slice();
                        G_History.lastLeftGrassFrame = G_History.frame;
                    }
                    if (ctx.meStatus.boosted) me.go(2); else me.go();
                    G_History.lastAttemptedStep = next;
                    if (act.isDefense) {
                        recordDodgeSource(ctx.myPos);
                    }
                } else {
                    me.turn(d);
                }
            }
        }
    }
}
function getNextStep(start, goal, ctx) {
    if (samePos(start, goal)) {
        G_History.path = [];
        G_History.pathTarget = null;
        return null;
    }
    var useCache = false;
    if (G_History.path && G_History.path.length > 0 && samePos(G_History.pathTarget, goal)) {
        if (samePos(start, G_History.path[0])) {
            G_History.path.shift();
        }
        if (G_History.path.length > 0) {
            var nextNode = G_History.path[0];
            if (getDist(start, nextNode) === 1 && isPassable(nextNode, ctx.map) && isSafe(nextNode, ctx, true)) {
                useCache = true;
            }
        }
    }
    var res = null;
    if (useCache) {
        res = G_History.path[0];
    } else {
        var path = aStar(start, goal, ctx);
        if (path && path.length > 0) {
            G_History.path = path;
            G_History.pathTarget = goal;
            res = G_History.path[0];
        } else {
            G_History.path = [];
            G_History.pathTarget = null;
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
            res = best;
        }
    }
    if (res && !isSafe(res, ctx, true) && isSafe(start, ctx, true)) {
        var myPosInGrass = G_Blueprint.mapVision.grass[start[0] + "," + start[1]];
        var shouldBlock = myPosInGrass;
        if (!shouldBlock) {
            if (ctx.enemyBullet && getFramesToHit(start, ctx.enemyBullet, ctx.map) <= 5) {
                shouldBlock = true;
            }
            if (!shouldBlock && ctx.enemyPos) {
                var enemyInGrass = G_Blueprint.mapVision.grass[ctx.enemyPos[0] + "," + ctx.enemyPos[1]];
                if (enemyInGrass) {
                    shouldBlock = true;
                }
            }
        }
        if (shouldBlock) {
            G_History.path = [];
            G_History.pathTarget = null;
            return null;
        }
    }
    return res;
}
function findOffAxisMove(ctx) {
    var neighbors = ["up", "right", "down", "left"], best = null, maxS = -1;
    for (var i = 0; i < neighbors.length; i++) {
        var dir = neighbors[i];
        var n = addPos(ctx.myPos, delta(dir));
        if (isPassable(n, ctx.map)) {
            if (isSafe(n, ctx, false)) {
                var s = getDist(n, ctx.enemyPos);
                var isNeighborOnAxis = (n[0] === ctx.enemyPos[0] || n[1] === ctx.enemyPos[1]);
                if (!isNeighborOnAxis) s += 0.5;
                if (directionTo(ctx.myPos, n) === ctx.myDir) s += 0.1;
                if (ctx.starPos) {
                    s += Math.max(0, (50 - getDist(n, ctx.starPos)) * 0.001);
                }
                if (isEnemyOverloadActive(ctx, ctx.myPos) && ctx.enemyDir) {
                    var isSafeSide = false;
                    var eDir = ctx.enemyDir;
                    if (eDir === "up" || eDir === "down") {
                        var onMain = (ctx.myPos[0] === ctx.enemyPos[0]);
                        if (onMain) {
                            if (n[0] < ctx.enemyPos[0]) isSafeSide = true;
                        } else {
                            if (n[0] > ctx.enemyPos[0] + 1) isSafeSide = true;
                        }
                    } else if (eDir === "left" || eDir === "right") {
                        var onMain = (ctx.myPos[1] === ctx.enemyPos[1]);
                        if (onMain) {
                            if (n[1] < ctx.enemyPos[1]) isSafeSide = true;
                        } else {
                            if (n[1] > ctx.enemyPos[1] + 1) isSafeSide = true;
                        }
                    }
                    if (isSafeSide) s += 0.01;
                }
                if (s > maxS) { maxS = s; best = n; }
            }
            else if (isOnEnemyGunLine(n, ctx, true)) {
                var n2 = addPos(n, delta(dir));
                if (isPassable(n2, ctx.map) && isSafe(n2, ctx, false)) {
                    var s = getDist(n2, ctx.enemyPos);
                    var isN2OnAxis = (n2[0] === ctx.enemyPos[0] || n2[1] === ctx.enemyPos[1]);
                    if (!isN2OnAxis) s += 0.5;
                    if (directionTo(ctx.myPos, n2) === ctx.myDir) s += 0.1;
                    if (ctx.starPos) {
                        s += Math.max(0, (50 - getDist(n2, ctx.starPos)) * 0.001);
                    }
                    s -= 2.0;
                    if (isEnemyOverloadActive(ctx, ctx.myPos) && ctx.enemyDir) {
                        var isSafeSide = false;
                        var eDir = ctx.enemyDir;
                        if (eDir === "up" || eDir === "down") {
                            var onMain = (ctx.myPos[0] === ctx.enemyPos[0]);
                            if (onMain) {
                                if (n2[0] < ctx.enemyPos[0]) isSafeSide = true;
                            } else {
                                if (n2[0] > ctx.enemyPos[0] + 1) isSafeSide = true;
                            }
                        } else if (eDir === "left" || eDir === "right") {
                            var onMain = (ctx.myPos[1] === ctx.enemyPos[1]);
                            if (onMain) {
                                if (n2[1] < ctx.enemyPos[1]) isSafeSide = true;
                            } else {
                                if (n2[1] > ctx.enemyPos[1] + 1) isSafeSide = true;
                            }
                        }
                        if (isSafeSide) s += 0.01;
                    }
                    if (s > maxS) { maxS = s; best = n; }
                }
            }
        }
    }
    return best ? { action: "move", target: best, score: 25000 } : null;
}
function findSafeGrassSpot(ctx) {
    var grass = [];
    var list = G_Blueprint.mapVision.grassList || [];
    var isEnemyOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (G_History.lastLeftGrassPos && samePos(p, G_History.lastLeftGrassPos)) {
            if (G_History.frame - G_History.lastLeftGrassFrame <= 3) {
                continue;
            }
        }
        if (isEnemyOverload && ctx.enemyPos) {
            if (p[0] > ctx.enemyPos[0] || p[1] > ctx.enemyPos[1]) continue;
        }
        if (ctx.enemyPos && getDist(p, ctx.enemyPos) <= 10) continue;
        if (!isSafe(p, ctx, true)) continue;
        grass.push(p);
    }
    if (grass.length === 0) return null;
    grass.sort(function (a, b) { return getDist(b, ctx.enemyPos) - getDist(a, ctx.enemyPos); });
    return grass[0];
}
function findNearestGrass(pos) {
    var best = null, minDist = 999;
    var list = G_Blueprint.mapVision.grassList || [];
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var d = getDist(pos, p); if (d < minDist) { minDist = d; best = p; }
    }
    return best;
}
function findNearestSafeGrass(pos, ctx) {
    var best = null, minDist = 999;
    var list = G_Blueprint.mapVision.grassList || [];
    var isEnemyOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var d = getDist(pos, p);
        if (d >= minDist) continue;
        if (G_History.lastLeftGrassPos && samePos(p, G_History.lastLeftGrassPos)) {
            if (G_History.frame - G_History.lastLeftGrassFrame <= 3) {
                continue;
            }
        }
        if (isEnemyOverload && ctx.enemyPos) {
            if (p[0] > ctx.enemyPos[0] || p[1] > ctx.enemyPos[1]) continue;
        }
        if (ctx.enemyPos && getDist(p, ctx.enemyPos) <= 2) continue;
        if (!isSafe(p, ctx, true)) continue;
        minDist = d; best = p;
    }
    return best;
}
function isLoS(s, e, dir, map) {
    if (!s || !e) return false;
    var cacheKey = s[0] + "," + s[1] + "|" + e[0] + "," + e[1] + "|" + dir;
    if (G_LoSCache[cacheKey] !== undefined) return G_LoSCache[cacheKey];
    var res = (function () {
        if (s[0] !== e[0] && s[1] !== e[1]) return false;
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
    })();
    G_LoSCache[cacheKey] = res;
    return res;
}
function canShoot(a, b, map) {
    if (!a || !b) return false;
    var cacheKey = a[0] + "," + a[1] + "|" + b[0] + "," + b[1];
    if (G_CanShootCache[cacheKey] !== undefined) return G_CanShootCache[cacheKey];
    var res = (function () {
        if (samePos(a, b) || (a[0] !== b[0] && a[1] !== b[1])) return false;
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
    })();
    G_CanShootCache[cacheKey] = res;
    return res;
}
function findAssassinSpot(ctx) {
    var e = ctx.enemyPos;
    var candidates = [];
    var dist = 5;
    var offsets = getAssassinOffsets(ctx.enemyDir, dist);
    for (var i = 0; i < offsets.length; i++) {
        var p = addPos(e, offsets[i]);
        if (isPassable(p, ctx.map) && canShoot(p, e, ctx.map) === true && isSafe(p, ctx, false, true)) {
            if (G_History.lastEnemyPos && getDist(p, G_History.lastEnemyPos) < 5) continue;
            var isGrass = G_Blueprint.mapVision.grass[p[0] + "," + p[1]] ? 1 : 0;
            var score = isGrass * 1000 - dist * 100 - i;
            if (ctx.myDir === directionTo(p, e)) {
                score += 300;
            }
            candidates.push({ pos: p, score: score });
        }
    }
    if (ctx.enemyDir) {
        var ed = delta(ctx.enemyDir);
        var predE = addPos(e, [ed[0] * 2, ed[1] * 2]);
        if (isPassable(predE, ctx.map) && isPassable(addPos(e, ed), ctx.map)) {
            for (var i = 0; i < offsets.length; i++) {
                var p = addPos(predE, offsets[i]);
                if (isPassable(p, ctx.map) && canShoot(p, predE, ctx.map) === true && isSafe(p, ctx, true, true)) {
                    if (G_History.lastEnemyPos && getDist(p, G_History.lastEnemyPos) < 5) continue;
                    var isGrass = G_Blueprint.mapVision.grass[p[0] + "," + p[1]] ? 1 : 0;
                    var score = isGrass * 1000 - dist * 100 - i - 50;
                    if (ctx.myDir === directionTo(p, predE)) {
                        score += 300;
                    }
                    candidates.push({ pos: p, score: score });
                }
            }
        }
    }
    if (candidates.length > 0) {
        candidates.sort(function (a, b) { return b.score - a.score; });
        return candidates[0].pos;
    }
    return null;
}
function getAssassinOffsets(enemyDir, dist) {
    var d = enemyDir || "up";
    var s = dist || 5;
    if (d === "up") return [[0, s], [-s, 0], [s, 0], [0, -s]];
    if (d === "down") return [[0, -s], [-s, 0], [s, 0], [0, s]];
    if (d === "left") return [[s, 0], [0, -s], [0, s], [-s, 0]];
    if (d === "right") return [[-s, 0], [0, -s], [0, s], [s, 0]];
    return [[-s, 0], [s, 0], [0, -s], [0, s]];
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
function overloadRightDir(d) { return { up: "right", right: "down", down: "right", left: "down" }[d]; }
function isPassable(p, map) { if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return false; var t = map[p[0]][p[1]]; return t !== "x" && t !== "m"; }
function isTeleportPassable(p, ctx) {
    if (!isPassable(p, ctx.map)) return false;
    var k = p[0] + "," + p[1];
    if (G_History.failedTeleportSpots && G_History.failedTeleportSpots[k]) {
        if (G_History.frame - G_History.failedTeleportSpots[k] < 15) {
            return false;
        }
    }
    return true;
}
function getTile(p, map) { if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return null; return map[p[0]][p[1]]; }
function getTurnDir(currentDir, targetDir, enemyPos, myPos, map) {
    if (!targetDir || currentDir === targetDir) return null;
    var dirs = ["up", "right", "down", "left"];
    var curIdx = dirs.indexOf(currentDir);
    var tarIdx = dirs.indexOf(targetDir);
    if (curIdx === -1 || tarIdx === -1) return null;
    var diff = (tarIdx - curIdx + 4) % 4;
    if (diff === 1) return "right";
    if (diff === 3) return "left";
    if (enemyPos && myPos) {
        var dirToEnemy = directionTo(myPos, enemyPos);
        var intermediateRight = dirs[(curIdx + 1) % 4];
        var intermediateLeft = dirs[(curIdx + 3) % 4];
        var pRight = addPos(myPos, delta(intermediateRight));
        var pLeft = addPos(myPos, delta(intermediateLeft));
        var rightPassable = isPassable(pRight, map);
        var leftPassable = isPassable(pLeft, map);
        if (rightPassable && !leftPassable) return "right";
        if (!rightPassable && leftPassable) return "left";
        if (intermediateRight === dirToEnemy) return "left";
        if (intermediateLeft === dirToEnemy) return "right";
    }
    return "right";
}
function recordDodgeSource(pos) {
    if (!pos) return;
    if (!G_History.recentDodgeSource) {
        G_History.recentDodgeSource = {};
    }
    var key = pos[0] + "," + pos[1];
    G_History.recentDodgeSource[key] = G_History.frame;
}
function isNearGrass(pos) {
    if (!pos || !G_Blueprint.mapVision || !G_Blueprint.mapVision.grass) return false;
    var x = pos[0], y = pos[1];
    var keys = [
        x + "," + y,
        (x + 1) + "," + y,
        (x - 1) + "," + y,
        x + "," + (y + 1),
        x + "," + (y - 1)
    ];
    for (var i = 0; i < keys.length; i++) {
        if (G_Blueprint.mapVision.grass[keys[i]]) return true;
    }
    return false;
}
function findTargetGrassForBlindFire(myPos, myDir, enemyPrevPos, map) {
    var candidates = [
        enemyPrevPos,
        [enemyPrevPos[0] + 1, enemyPrevPos[1]],
        [enemyPrevPos[0] - 1, enemyPrevPos[1]],
        [enemyPrevPos[0], enemyPrevPos[1] + 1],
        [enemyPrevPos[0], enemyPrevPos[1] - 1]
    ];
    for (var i = 0; i < candidates.length; i++) {
        var p = candidates[i];
        if (!isPassable(p, map)) continue;
        var isGrass = G_Blueprint.mapVision.grass[p[0] + "," + p[1]];
        if (!isGrass) continue;
        if (p[0] === myPos[0] || p[1] === myPos[1]) {
            if (directionTo(myPos, p) === myDir) {
                if (canShoot(myPos, p, map) === true) {
                    return p;
                }
            }
        }
    }
}
function findBestStarTeleportTarget(ctx) {
    if (!ctx.starPos) return null;
    var star = ctx.starPos;
    var adjs = [
        [star[0], star[1] - 1],
        [star[0], star[1] + 1],
        [star[0] - 1, star[1]],
        [star[0] + 1, star[1]]
    ];
    var candidates = [];
    for (var i = 0; i < adjs.length; i++) {
        var p = adjs[i];
        if (isPassable(p, ctx.map) && isSafeForStarTeleport(p, ctx)) {
            var score = 0;
            if (G_Blueprint.mapVision.grass[p[0] + "," + p[1]]) {
                score += 10;
            }
            var dirToStar = directionTo(p, star);
            if (dirToStar === ctx.myDir) {
                score += 5;
            }
            candidates.push({ pos: p, score: score });
        }
    }
    if (candidates.length === 0) return null;
    candidates.sort(function (a, b) {
        return b.score - a.score;
    });
    return candidates[0].pos;
}
function findAmbushGrassTile(star, map, forShooting) {
    if (!map) return null;
    var starPos = star || G_History.lastStarPos || (map.length === 13 ? [6, 6] : null);
    if (!starPos) return null;
    var list = G_Blueprint.mapVision.grassList || [];
    var bestSpot = null;
    var bestScore = -9999;
    for (var i = 0; i < list.length; i++) {
        var g = list[i];
        var gKey = g[0] + "," + g[1];
        if (G_History.invalidPredictedSpots && G_History.invalidPredictedSpots[gKey]) {
            continue;
        }
        if (forShooting && G_History.firedPredictedSpots && G_History.firedPredictedSpots[gKey]) {
            continue;
        }
        if (samePos(g, starPos)) {
            continue;
        }
        var d = getDist(g, starPos);
        if (d <= 6) {
            var dir = directionTo(g, starPos);
            var isCoAxial = (g[0] === starPos[0] || g[1] === starPos[1]);
            var hasLoS = isCoAxial && isLoS(g, starPos, dir, map);
            var score = 100 - d * 20;
            if (isCoAxial) score += 30;
            if (hasLoS) score += 50;
            if (score > bestScore) {
                bestScore = score;
                bestSpot = { pos: g, dir: dir };
            }
        }
    }
    return bestSpot;
}
function findGrassOnGunLine(myPos, myDir, map, maxDist) {
    var d = delta(myDir);
    if (d[0] === 0 && d[1] === 0) return null;
    var p = myPos.slice();
    for (var i = 1; i <= maxDist; i++) {
        p = addPos(p, d);
        if (!isPassable(p, map)) {
            return null;
        }
        var tile = getTile(p, map);
        if (tile === "o") {
            return p;
        }
    }
    return null;
}
function fireGun(me, ctx) {
    if (!me.bullet && !ctx.meStatus.fireLocked) {
        me.fire();
        if (G_History.isEnemyPosPredicted && ctx.shootingEnemyPos) {
            if (isPositionOnGunLine(ctx.myPos, ctx.myDir, ctx.shootingEnemyPos, ctx.map)) {
                var spotKey = ctx.shootingEnemyPos[0] + "," + ctx.shootingEnemyPos[1];
                if (!G_History.firedPredictedSpots) G_History.firedPredictedSpots = {};
                G_History.firedPredictedSpots[spotKey] = true;
            }
        }
    }
}
function isPositionOnGunLine(myPos, myDir, targetPos, map) {
    if (!targetPos) return false;
    var d = delta(myDir);
    if (d[0] === 0 && d[1] === 0) return false;
    var isCoAxial = false;
    if (d[0] !== 0 && myPos[1] === targetPos[1] && (targetPos[0] - myPos[0]) * d[0] > 0) isCoAxial = true;
    if (d[1] !== 0 && myPos[0] === targetPos[0] && (targetPos[1] - myPos[1]) * d[1] > 0) isCoAxial = true;
    if (!isCoAxial) return false;
    return isLoS(myPos, targetPos, myDir, map);
}
function recalculateAmbushPrediction(map) {
    var ambushSpot = findAmbushGrassTile(G_History.lastStarPos, map, false);
    if (ambushSpot) {
        G_History.lastEnemyPos = ambushSpot.pos;
        G_History.lastEnemyDir = ambushSpot.dir;
        G_History.lastEnemySeenFrame = G_History.frame;
        G_History.isEnemyPosPredicted = true;
    } else {
        G_History.lastEnemyPos = null;
        G_History.isEnemyPosPredicted = false;
    }
}
function buildDangerTilesCache(bullet, map, isOverload) {
    G_DangerTiles = {};
    if (!bullet) return;
    cacheSingleBulletDanger(bullet, map);
    if (isOverload) {
        var bDir = bullet.direction;
        var rDir = overloadRightDir(bDir);
        if (rDir) {
            var virtualPos = addPos(bullet.position, delta(rDir));
            var virtualBullet = { position: virtualPos, direction: bDir };
            cacheSingleBulletDanger(virtualBullet, map);
        }
    }
}
function cacheSingleBulletDanger(bullet, map) {
    var p = bullet.position.slice();
    var d = bullet.direction;
    var st = delta(d);
    if (st[0] === 0 && st[1] === 0) return;
    var dist = 0;
    var safety = 0;
    var curr = p.slice();
    while (safety < 30) {
        var tile = getTile(curr, map);
        if (!tile || tile === "x" || tile === "m") {
            break;
        }
        if (dist > 0) {
            var frames = Math.ceil(dist / 2);
            var keyStr = curr[0] + "," + curr[1];
            if (G_DangerTiles[keyStr] === undefined || frames < G_DangerTiles[keyStr]) {
                G_DangerTiles[keyStr] = frames;
            }
        }
        curr = addPos(curr, st);
        dist++;
        safety++;
    }
}