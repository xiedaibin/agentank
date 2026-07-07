/**
 * AgenTank AI Agent - XDB (Strategic Assassin V12.97 - Performance optimization caching)
 * V12.97: 引入 canShoot, isLoS 以及 isOnEnemyGunLine 的帧内缓存优化，降低运行开销以规避平局 runtime 判定劣势
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
var G_AStarCache = {};  // 帧内 A* 路径缓存：同一帧相同 (start,goal) 直接复用结果，避免重复寻路
var G_CanShootCache = {};
var G_LoSCache = {};
var G_OnGunLineCache = {};

/**
 * 核心决策入口函数，引擎在坦克没有动作队列时每帧调用一次
 * @param {Object} me 我方坦克状态数据
 * @param {Object} enemy 敌方坦克状态数据
 * @param {Object} game 全局战场地图与状态数据
 */
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
                me.speak("传送失败记录");
            }
            G_History.lastTeleportTarget = null;
        }
        if (enemy && enemy.status && enemy.status.overloaded) {
            G_History.lastEnemyOverloadedFrame = G_History.frame;
        }
        if (G_History.frame <= 1 && !G_History.hasSpokenInit) {
            me.speak("V12.97: 预判背杀");
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

        // 发现子弹的视觉 Speak 预警
        if (ctx.enemyBullet) {
            if (!G_History.hasSpokenBullet) {
                me.speak("发现了子弹");
                G_History.hasSpokenBullet = true;
            }
        } else {
            G_History.hasSpokenBullet = false;
        }

        // 撞击隐藏敌方检测与反击
        var lastAttempted = G_History.lastAttemptedStep;
        G_History.lastAttemptedStep = null;
        if (lastAttempted && G_History.lastPos && samePos(ctx.myPos, G_History.lastPos)) {
            if (isPassable(lastAttempted, ctx.map)) {
                var dir = directionTo(ctx.myPos, lastAttempted);
                if (ctx.myDir === dir && !me.bullet && !ctx.meStatus.fireLocked) {
                    me.speak("Blocked: Fire!");
                    fireGun(me, ctx);
                    return;
                }
            }
        }

        // 1. 绝杀与 Mound 压制
        var isTeleportAmbushStream = G_History.isAmbushStreamDetected && G_History.enemyInvisibleFrames >= 5;
        if ((isTeleportAmbushStream || ctx.enemyVisible) && !ctx.enemyShielded) {
            var cs = canShoot(ctx.myPos, ctx.enemyPos, ctx.map);
            if (cs === true || (cs === "mound" && getDist(ctx.myPos, ctx.enemyPos) <= 7)) {
                var dir = directionTo(ctx.myPos, ctx.enemyPos);
                if (ctx.myDir === dir && !me.bullet && !ctx.meStatus.fireLocked) {
                    // 如果处于超载敌人的双枪线下，且对方正对我们且未开火锁定，禁止站立射击，强制规避
                    var onOverloadLine = isOnEnemyGunLine(ctx.myPos, ctx, true);
                    var enemyFacingUs = isLoS(ctx.enemyPos, ctx.myPos, ctx.enemyDir, ctx.map);
                    if (onOverloadLine && enemyFacingUs && !ctx.enemyFireLocked && isEnemyOverloadActive(ctx, ctx.myPos)) {
                        // 允许进入下一阶段（防守规避）
                    } else {
                        fireGun(me, ctx); return;
                    }
                }
            }
        }

        // 1.5. 草丛盲射 (Blind Fire)
        if (!ctx.enemyVisible && ctx.isEnemyRecentlyInvisibleInGrass) {
            var targetGrass = findTargetGrassForBlindFire(ctx.myPos, ctx.myDir, G_History.lastEnemyPos, ctx.map);
            if (targetGrass && !me.bullet && !ctx.meStatus.fireLocked) {
                me.speak("草丛盲射");
                fireGun(me, ctx); return;
            }
        }

        // 2. 紧急防御 (模块化路由)
        var defenseAction = tacticalDefense(me, ctx);
        if (defenseAction) {
            defenseAction.isDefense = true;
            executeAction(me, defenseAction, ctx);
            return;
        }



        // 3. 战术评估
        var bestAction = tacticalAnalysis(ctx);
        executeAction(me, bestAction, ctx);

    } catch (e) { print("Error: " + e.message); }
}

/**
 * 战略侧写与地图静态分析初始化（第0帧或首次捕获敌人时执行一次）
 * @param {Object} enemy 敌方坦克状态数据
 * @param {Array} map 战场二维地图网格
 */
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
                STANCE: "ANTI_CONTROL", DANGER_RADIUS: 9, ASTAR_UNSAFE_PENALTY: 3000,
                ENABLE_ASSASSINATION: false, MAX_NODES: 200
            };
        } else if (sType === "stun") {
            G_Blueprint.Tactics = {
                STANCE: "ANTI_CONTROL", DANGER_RADIUS: 5, ASTAR_UNSAFE_PENALTY: 3000,
                ENABLE_ASSASSINATION: false, MAX_NODES: 200
            };
        } else if (sType === "overload") {
            G_Blueprint.Tactics = {
                STANCE: "DEFAULT", DANGER_RADIUS: 5, ASTAR_UNSAFE_PENALTY: 2000,
                ENABLE_ASSASSINATION: true, MAX_NODES: 250
            };
        } else if (sType === "shield") {
            G_Blueprint.Tactics = {
                STANCE: "DEFAULT", DANGER_RADIUS: 3, ASTAR_UNSAFE_PENALTY: 2000,
                ENABLE_ASSASSINATION: true, MAX_NODES: 250
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

/**
 * 地图静态扫描，分析并缓存硬墙壁和所有草丛格子
 * @param {Array} map 二维网格地图
 */
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

/**
 * 构建当前帧的动态执行上下文（整合我方、敌方、飞弹和幽灵枪线安全等动态数据）
 */
function buildExecutionContext(me, enemy, game) {
    // 每一帧更新危险子弹格缓存以供 O(1) 避弹判定，消除 A* 重复计算
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
            me.speak("踩中拉黑重算");
        }
    }

    if (game && game.star) {
        G_History.lastStarPos = game.star;
    }
    var eTank = enemy ? enemy.tank : null;
    var visible = !!eTank;

    if (G_History.lastUpdatedFrame !== G_History.frame) {
        // 维护我方的草丛状态及入口记忆
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
                    me.speak("敌传至: [" + eTank.position[0] + "," + eTank.position[1] + "]");
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
                    me.speak("预判在: [" + ambushSpot.pos[0] + "," + ambushSpot.pos[1] + "]");
                }
            }
        }

        G_History.lastUpdatedFrame = G_History.frame;
    }

    var unsafeCoAxialTiles = {};
    var limit = G_Blueprint.Tactics.STANCE === "ANTI_CLOAK" ? 60 : 55;
    // Fix P0-1: 传送预判模式下禁止触发coAxial标记（lastEnemyPos是推算坐标非真实消失点）
    var skipCoAxial = G_History.isEnemyPosPredicted;
    if (!skipCoAxial && !visible && G_History.lastEnemyPos && (G_History.frame - G_History.lastEnemySeenFrame < limit)) {
        var lastSeen = G_History.lastEnemyPos;
        var elapsed = G_History.frame - G_History.lastEnemySeenFrame;
        var maxDist = Math.min(5, elapsed + 1);
        // Fix P0-1: 射线长度从30缩减到max(6, DANGER_RADIUS+2)，避免覆盖整张地图
        var maxRayLen = Math.max(6, (G_Blueprint.Tactics.DANGER_RADIUS || 4) + 2);
        var potentialGrass = [];
        var list = G_Blueprint.mapVision.grassList || [];
        for (var i = 0; i < list.length; i++) {
            var g = list[i];
            if (samePos(g, myPos)) continue; // 敌方不可能在我方当前占领的格子里，排除伪射线
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

    var predictedEnemyPos = currentEnemyPos ? currentEnemyPos.slice() : null;
    var predictedEnemyDir = currentEnemyDir;

    // 当敌人不可见且场上有星星时，推算其朝向星星前行的推导位置
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

    // 新增：如果敌人处于不可见（隐身/草丛），且消失超过 8 帧以上，默认其枪口正对准我方坦克的方向
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
            me.speak("敌得分! 我:" + me.stars + " 敌:" + G_History.lastEnemyStars);
        }
    }
    var enemyStars = G_History.lastEnemyStars || 0;

    if (G_History.lastSpokenMeStars === undefined) G_History.lastSpokenMeStars = 0;
    if (me.stars > G_History.lastSpokenMeStars) {
        G_History.lastSpokenMeStars = me.stars;
        me.speak("我得分! 我:" + me.stars + " 敌:" + enemyStars);
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

/**
 * 战术决策分析，评分并筛选出本帧最优的候选战术动作
 * @param {Object} ctx 动态执行上下文
 */
function tacticalAnalysis(ctx) {
    var rawCandidates = [];
    if (ctx.canTeleport) {
        if (G_Blueprint.Tactics.ENABLE_ASSASSINATION) rawCandidates.push(evalAssassination(ctx));
        if (G_Blueprint.Tactics.STANCE === "ANTI_CLOAK") rawCandidates.push(evalPanicTeleport(ctx));
    }
    if (G_Blueprint.Tactics.ENABLE_ASSASSINATION) {
        rawCandidates.push(evalAssassinationPreAim(ctx));
    }
    rawCandidates.push(evalShooting(ctx));
    rawCandidates.push(evalPreAim(ctx));
    rawCandidates.push(evalStarCollection(ctx));
    rawCandidates.push(evalStarGuard(ctx));
    rawCandidates.push(evalPathAmbushFire(ctx));
    rawCandidates.push(evalPathAmbush(ctx));
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

/**
 * 评估对抗隐身敌人的紧急传送防突脸避险
 * @param {Object} ctx 上下文
 */
function evalPanicTeleport(ctx) {
    if (ctx.enemyCloaked && !isSafeForAntiCloak(ctx.myPos, ctx)) {
        var esc = findSafeGrassSpot(ctx) || findSafeQuadrantSpot(ctx);
        if (esc && !samePos(esc, ctx.myPos) && isTeleportPassable(esc, ctx)) return { action: "teleport", target: esc, score: 99999 };
    }
    return null;
}

/**
 * 传送暗杀动作评估：在满足暗杀时机、且确保我方子弹与火控就绪的前提下，寻找敌方侧后方的安全落点进行背杀
 * @param {Object} ctx 动态上下文
 */
function evalAssassination(ctx) {
    if (!ctx.enemyPos || (ctx.enemy && ctx.enemy.status && ctx.enemy.status.shielded)) return null;
    if (ctx.enemyCloaked && !ctx.enemyFireLocked) return null;

    // 新增：暗杀前必须确保我方子弹与火控均就绪，避免空弹瞬移送命
    if (ctx.me.bullet || ctx.meStatus.fireLocked) return null;

    var isTeleportAmbushStream = G_History.isAmbushStreamDetected && G_History.enemyInvisibleFrames >= 5;
    if (isTeleportAmbushStream || (ctx.meStars < ctx.enemyStars && !ctx.enemySkillReady)) {
        if (isTeleportAmbushStream) {
            var enemyInGrass = G_Blueprint.mapVision && G_Blueprint.mapVision.grass[ctx.enemyPos[0] + "," + ctx.enemyPos[1]];
            if (!enemyInGrass) return null;
        }
        var spot = findAssassinSpot(ctx);
        if (spot && !samePos(spot, ctx.myPos) && isTeleportPassable(spot, ctx) && isSafeForStarTeleport(spot, ctx, true)) {
            var fireDir = directionTo(spot, ctx.enemyPos);
            if (ctx.myDir !== fireDir) {
                ctx.me.speak("刺杀预瞄");
                return { action: "turn", target: addPos(ctx.myPos, delta(fireDir)), score: CONFIG.KILL_PRIO + 100, type: "assassinate" };
            }
            if (isTeleportAmbushStream) {
                ctx.me.speak("刺杀埋伏: [" + ctx.enemyPos[0] + "," + ctx.enemyPos[1] + "]");
            }
            return { action: "teleport", target: spot, score: CONFIG.KILL_PRIO + 100, type: "assassinate" };
        }
    }
    return null;
}

/**
 * 评估本帧直接射击或打爆土堆开辟通道的可能性
 * @param {Object} ctx 上下文
 */
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
                return null; // 放弃扭头对枪，优先让直行吃星胜出
            }
            return { action: "turn", target: ctx.shootingEnemyPos, score: CONFIG.KILL_PRIO - 100, type: "shoot" };
        }
    }
    return null;
}

/**
 * 评估在草丛潜伏或刚传送落地时的“轴线预瞄”偏头对准
 * @param {Object} ctx 上下文
 */
function evalPreAim(ctx) {
    if (evalPathAmbushFire(ctx)) {
        return null;
    }

    if (G_History.preAimLockoutUntil && G_History.frame < G_History.preAimLockoutUntil) {
        return null;
    }

    // 防范超载坦克的非对称弹道。如果在超载坦克的右/下威胁区且中近距离（≤5），放弃预瞄
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
                ctx.me.speak("预瞄超时，退出挂机");
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

/**
 * 评估步行抢星、传送抢星及传送落地 T+1 帧的延迟等待与调整车头逻辑
 * @param {Object} ctx 上下文
 */
function evalStarCollection(ctx) {
    if (!ctx.starPos) return null;
    var dist = getDist(ctx.myPos, ctx.starPos);

    // 如果我们在草丛里已经对准了伏击枪线，且星格距离大于 1，放弃抢星，坚守伏击防止抽搐
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

    // 高层决策惯性奖励，防止目标震荡
    if (G_History.lastActionType === "star") {
        score += 150;
    }

    var isEnemyTeleport = ctx.enemy && ctx.enemy.skill && ctx.enemy.skill.type === "teleport";
    //等待时间大于判定传送草丛预杀流的判定时间5
    var isMyPosAt2_2 = samePos(ctx.myPos, [2, 2]);
    var forbidEarlyTP = isEnemyTeleport && G_History.frame <= 6 && !isMyPosAt2_2;

    // 针对传送后 T+1 帧吃星延迟的特殊处理
    if (G_History.frame - G_History.starTeleportFrame === 1) {
        if (dist === 1) {
            var dirToStar = directionTo(ctx.myPos, ctx.starPos);
            if (ctx.myDir === dirToStar) {
                // 原地等待 1 帧
                ctx.me.speak("传送延迟等待");
                return { action: "move", target: ctx.myPos, score: CONFIG.STAR_PRIO + 500, type: "star" };
            } else {
                // 转向星格
                ctx.me.speak("传送延迟转向");
                return { action: "turn", target: ctx.starPos, score: CONFIG.STAR_PRIO + 500, type: "star" };
            }
        }
    }

    // 正常传送逻辑：不再传送到星格中心，而是传送到最安全、效率最高的相邻格
    // 如果是最后阶段 (例如 frame >= 100)，且我方星星领先，则不传送吃星以保护优势
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

        // 【避险防折返拦截】：如果去往星格的下一步是最近 3 帧内避险移出的来源格，判定为不安全
        if (safeForWalking && G_History.recentDodgeSource) {
            var nextKey = nextStep[0] + "," + nextStep[1];
            var reflexFrame = G_History.recentDodgeSource[nextKey];
            if (reflexFrame !== undefined && (G_History.frame - reflexFrame <= 3)) {
                safeForWalking = false;
            }
        }

        // 【最完备子弹时空账判定】：
        // 如果去往下一步需要原地转身（产生 1 帧硬直，使坦克在当前格多停留 1 帧），
        // 且空中已有一颗敌方子弹正飞向我们当前格（ctx.myPos），且预计在 2 帧内击中。
        // 这意味着执行抢星会导致在当前格原地转身被直接炸死。必须强行判定为不安全，降级让位给即时逃生动作。
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

/**
 * 评估守星枪线压制（射击封锁敌方抢星路线，或近身危险时倒车逃逸）
 * @param {Object} ctx 上下文
 */
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

    // 高层决策惯性奖励，防止目标震荡
    var scoreBonus = (G_History.lastActionType === "guard") ? 150 : 0;

    if (ctx.enemyPos && getDist(ctx.myPos, ctx.enemyPos) === 1) {
        var dirToStar = directionTo(ctx.myPos, ctx.starPos);
        var revDir = reverseDir(dirToStar);
        var escapePos = addPos(ctx.myPos, delta(revDir));
        if (isPassable(escapePos, ctx.map)) {
            ctx.me.speak("守星撤退");
            return { action: "move", target: escapePos, score: 23000, type: "guard" };
        }
    }

    if (!ctx.me.bullet && !ctx.meStatus.fireLocked) {
        var dirToStar = directionTo(ctx.myPos, ctx.starPos);
        if (ctx.myDir === dirToStar) {
            ctx.me.speak("守星开火");
            return { action: "fire", target: ctx.starPos, score: 2200 + scoreBonus, type: "guard" };
        } else {
            ctx.me.speak("守星转向");
            return { action: "turn", target: ctx.starPos, score: 2200 + scoreBonus, type: "guard" };
        }
    }

    return null;
}

/**
 * 步进推演敌人前行至星格的预测轨道节点列表
 */
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

/**
 * 寻找敌人通道节点上的最佳草丛伏击格
 */
function findPathAmbushSpot(enemyPath, myPos, starPos, map, ctx) {
    var list = G_Blueprint.mapVision.grassList || [];
    var bestSpot = null;
    var bestScore = -9999;

    // 计算敌方速度用于时间差过滤
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

                    // 时间差过滤：如果我们在该格子时敌人还没走到（或者传送过去有时间准备）才有效
                    var timeToAmbush = samePos(myPos, g) ? 0 : (ctx.canTeleport ? 1 : getDist(myPos, g));
                    var enemyTimeToTarget = Math.ceil(node.step / enemySpeed);
                    if (enemyTimeToTarget < timeToAmbush) continue;

                    // 伏击打分：伏击格离相撞点越近(越准)越好，离我方当前位置越近越好，相撞点越靠后(准备时间更长)越好
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

/**
 * 评估大优势下的保星通道路径伏击战术
 * @param {Object} ctx 上下文
 */
function evalPathAmbush(ctx) {
    if (!ctx.starPos || !ctx.enemyPos || !ctx.enemy) return null;
    if (G_Blueprint.enemyProfile && (G_Blueprint.enemyProfile.hasOverload || G_Blueprint.enemyProfile.skillType == "teleport")) return null;

    // 优势判定：我方星星 >= 敌方星星 + 2
    var advantage = ctx.meStars >= (ctx.enemyStars + 2);
    if (!advantage) return null;

    // 1. 获取敌人前行路径
    var enemyPath = getEnemyPredictedPath(ctx.enemyPos, ctx.enemyDir, ctx.starPos, ctx.map);
    if (enemyPath.length === 0) return null;

    // 2. 寻找最佳通道伏击格
    var ambushSpot = findPathAmbushSpot(enemyPath, ctx.myPos, ctx.starPos, ctx.map, ctx);
    if (!ambushSpot) return null;

    var dist = getDist(ctx.myPos, ambushSpot.pos);

    // 如果未占领伏击点
    if (!samePos(ctx.myPos, ambushSpot.pos)) {
        // 1. 若传送就绪且安全，使用传送占领
        if (ctx.canTeleport && dist > 1) { // 距离大于 1 才传送，避免贴脸浪费 CD
            if (isTeleportPassable(ambushSpot.pos, ctx) && isSafeForStarTeleport(ambushSpot.pos, ctx, false)) {
                ctx.me.speak("优势传送伏击");
                return { action: "teleport", target: ambushSpot.pos, score: 2100, type: "ambush" };
            }
        }
        // 2. 步行走过去，需要确保安全
        if (isSafe(ambushSpot.pos, ctx, true)) {
            return { action: "move", target: ambushSpot.pos, score: 1800 - dist, type: "ambush" };
        }
    } else {
        // 已经占领伏击点
        // 3. 原地转向相撞点，偏正车头
        if (ctx.myDir !== ambushSpot.dir) {
            ctx.me.speak("伏击转向");
            return { action: "turn", target: ambushSpot.targetPos, score: 1900, type: "ambush" };
        }
        // 4. 无声潜伏，原地不动
        return { action: "move", target: ctx.myPos, score: 1850, type: "ambush" };
    }

    return null;
}

/**
 * 评估在优势伏击状态下的拦截开火
 * @param {Object} ctx 上下文
 */
function evalPathAmbushFire(ctx) {
    if (!ctx.enemyPos || !ctx.enemy) return null;

    // 防范超载坦克的非对称弹道。如果在超载坦克的右/下威胁区且中近距离（≤5），放弃通道伏击开火，让位给防御逃生
    var isEnemyOverload = G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.hasOverload;
    if (isEnemyOverload && ctx.enemyPos) {
        var d = getDist(ctx.myPos, ctx.enemyPos);
        if (d <= 5 && (ctx.myPos[0] > ctx.enemyPos[0] || ctx.myPos[1] > ctx.enemyPos[1])) {
            return null;
        }
    }

    // 必须在伏击草丛内
    var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
    if (!isCurrentlyInGrass) return null;

    // 1. 获取敌人前行路径
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
            ctx.me.speak("通道预判: " + bestInterception.T_enemy + "帧");
            return { action: "fire", target: bestInterception.targetPos, score: 2200, type: "ambush_fire" };
        }
    }

    return null;
}



/**
 * 评估草丛潜伏战术以及生存走位避险（兜底保命决策）
 * @param {Object} ctx 上下文
 */
function evalGrassAmbushAndSurvival(ctx) {
    var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
    var grass = findNearestSafeGrass(ctx.myPos, ctx);

    if (grass) {
        var starUnsafe = ctx.starPos && !isSafeForStarWalking(ctx.starPos, ctx);
        var score = 300;

        // Priority adjustment for bullet danger
        //if (ctx.enemyBullet && getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map) < 10) score -= 1000;

        if (isCurrentlyInGrass && (!ctx.starPos || starUnsafe)) {
            // Overload 近距离：即使在草丛里也要检查是否在枪线上，禁止待机被击
            var overloadNearby = ctx.enemyPos && isEnemyOverloadActive(ctx, ctx.myPos) && getDist(ctx.myPos, ctx.enemyPos) <= 4;
            if (overloadNearby && isOnEnemyGunLine(ctx.myPos, ctx, true)) {
                // 不在此处 return，让它fall-through到下面的grass寻路
            } else {
                // 金蝉脱壳：进入草丛首帧进行位置转移以欺骗盲射
                if (G_History.lastGrassEntrancePos && !G_History.hasShiftedInGrass && samePos(ctx.myPos, G_History.lastGrassEntrancePos)) {
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
                        ctx.me.speak("金蝉脱壳转移");
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
        //if (ctx.enemyBullet && getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map) < 10) score -= 1000;

        // 高层决策惯性奖励，防止目标震荡
        if (G_History.lastActionType === "survival") {
            score += (!isCurrentlyInGrass) ? 800 : 150;
        }

        return { action: "move", target: grass, score: score, type: "survival" };
    }

    // Default survival fallback
    var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx) || [9, 7];
    var fallbackScore = 100;
    if (G_History.lastActionType === "survival") {
        fallbackScore += (!isCurrentlyInGrass) ? 800 : 150;
    }
    return { action: "move", target: esc, score: fallbackScore, type: "survival" };
}

/**
 * 紧急规避防御模块（避开 5 帧内的实时子弹、幽灵盲区射线及空地直面枪口）
 */
function tacticalDefense(me, ctx) {
    if (ctx.enemyBullet) {
        var keyStr = ctx.myPos[0] + "," + ctx.myPos[1];
        var fH = G_DangerTiles[keyStr] !== undefined ? Math.ceil(G_DangerTiles[keyStr] / 2) : Infinity;
        if (fH <= 5) {
            var dodge = findBestDodge(ctx, fH);

            // 计算物理避弹是否需要转向（若需要，耗时会多1-2帧）
            var needTurn = dodge && (directionTo(ctx.myPos, dodge) !== ctx.myDir);
            var tooClose = fH <= 2 || (fH <= 3 && needTurn);

            if (ctx.canTeleport && (tooClose || !dodge)) {
                var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx);
                if (esc && !samePos(esc, ctx.myPos) && isTeleportPassable(esc, ctx)) {
                    me.speak("紧急避弹传送");
                    return { action: "teleport", target: esc, score: 99999 };
                }
            }
            if (dodge) { G_History.defenseLockTicks = 2; G_History.lastDefenseTarget = dodge; return { action: "move", target: dodge, score: 99999 }; }
        }
    }

    // 防御锁检测置顶：若无迫在眉睫的真实子弹威胁，且上一帧已经锁定了逃跑规避方向，坚持走完，防止原地转向抖动
    if (G_History.defenseLockTicks > 0 && G_History.lastDefenseTarget) {
        G_History.defenseLockTicks--;
        if (isSafe(G_History.lastDefenseTarget, ctx, true)) return { action: "move", target: G_History.lastDefenseTarget, score: 30000 };
    }

    // [方案B v2] 幽灵子弹轴线预判（收窄脱敏版）：减少误触发
    // 触发条件收紧：6帧内见过 + ≤7格近距
    if (!ctx.enemyBullet && ctx.enemyPos) {
        var recentlySeen = (G_History.frame - G_History.lastEnemySeenFrame < 6);
        if (recentlySeen || ctx.enemyCloaked) {
            var ghostDist = getDist(ctx.myPos, ctx.enemyPos);
            if (ghostDist <= 7) {
                var myPosInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];

                // 【草丛脱敏优化】：若身处草丛，且敌方尚未实际激活超载，则仅防范敌方普通主枪线；若在空地、敌方已开启超载，或敌方是超载坦克且技能就绪、距离极近（<=3），才防范超宽枪线
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
                                    me.speak("幽灵闪避传送");
                                    return { action: "teleport", target: esc, score: 99999 };
                                }
                            }
                            me.speak("幽灵避弹");
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

    // 幽灵子弹轴线预判扩展：如果我们在潜在的敌方草丛共轴枪线上，且在open ground
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
                            me.speak("共轴闪避传送");
                            return { action: "teleport", target: esc, score: 99999 };
                        }
                    }
                    me.speak("共轴避弹");
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
                            me.speak("安全闪避传送");
                            return { action: "teleport", target: esc, score: 99999 };
                        }
                    }
                    me.speak("安全规避");
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

// --- [4. 引擎核心] ---

/**
 * 判断敌人是否开启了 Overload 双发过载，或其技能处于就绪随时可开启的状态
 */
function isEnemyOverloadActive(ctx, pos) {
    if (!G_Blueprint.enemyProfile || !G_Blueprint.enemyProfile.hasOverload) return false;
    var recentlyOverloaded = G_History.lastEnemyOverloadedFrame && (G_History.frame - G_History.lastEnemyOverloadedFrame < 8);
    return (ctx.enemy && ctx.enemy.status && ctx.enemy.status.overloaded) ||
        (ctx.enemySkillReady) ||
        recentlyOverloaded;
}

/**
 * 判断某个格子位置是否暴露在敌方的当前直视枪线或双枪线超载范围内
 */
function isOnEnemyGunLine(pos, ctx, checkOverload) {
    if (!pos || !ctx.enemyPos || !ctx.enemyDir) return false;
    var cacheKey = pos[0] + "," + pos[1] + "|" + ctx.enemyPos[0] + "," + ctx.enemyPos[1] + "|" + ctx.enemyDir + "|" + (checkOverload ? 1 : 0);
    if (G_OnGunLineCache[cacheKey] !== undefined) return G_OnGunLineCache[cacheKey];

    var res = (function () {
        var d = delta(ctx.enemyDir);
        if (d[0] === 0 && d[1] === 0) return false;

        // 前瞻评估：当前位置 (k=0)、前行 1 格 (k=1)、前行 2 格 (k=2)
        for (var k = 0; k <= 2; k++) {
            var ePos = [ctx.enemyPos[0] + k * d[0], ctx.enemyPos[1] + k * d[1]];

            // 如果前行路径上遇到了硬墙或土堆，敌人无法继续前行，中断前瞻
            if (k > 0 && !isPassable(ePos, ctx.map)) break;

            // 1. 评估在该位置的主枪线
            var mainOrigin = addPos(ePos, d);
            if (isLoS(mainOrigin, pos, ctx.enemyDir, ctx.map)) return true;

            // 2. 评估在该位置的过载双枪线
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

/**
 * 核心安全检查器，评估目标格子未来 2-4 帧是否绝对安全（考虑子弹、控制半径、肉搏贴脸等）
 */
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
                    var limit = G_Blueprint.Tactics.STANCE === "ANTI_CLOAK" ? 40 : 35;
                    var enemySeenRecently = (G_History.frame - G_History.lastEnemySeenFrame < limit);
                    var realEnemyPos = G_History.lastEnemyPos;
                    var dReal = realEnemyPos ? getDist(pos, realEnemyPos) : d;
                    if (dReal <= 2) return false;
                    if (enemySeenRecently) {


                        var inGrass = G_Blueprint.mapVision.grass[pos[0] + "," + pos[1]];

                        // 针对草丛格子，如果与敌人最后真实消失点在中近距离（≤8格）共轴且无墙壁阻挡，在我们即将移入该格时判定为不安全
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

/**
 * 评估普通传送（如抢星）或暗杀传送目标点的高级安全度校验
 */
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
            // 只要落点暴露在敌人枪线上（包括 Overload 枪线），且敌人开火锁未激活，就禁止传送
            if (isOnEnemyGunLine(pos, ctx, true) && !ctx.enemyFireLocked) {
                return false;
            }
            // 哪怕敌人当前没对准我们，只要我们在其射程（8格）内且同轴（含过载轴），
            // 敌人随时可以在下帧转身开火。由于我们刚落地有 1 帧硬直无法移动，必须拉黑禁止传送
            if (d <= 8 && !ctx.enemyFireLocked) {
                // 1. 检测主轴线（只要没有硬墙阻挡，任何朝向都是危险的）
                var mainOnAxis = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
                if (mainOnAxis && canShoot(ctx.enemyPos, pos, ctx.map) === true) {
                    return false;
                }
                // 2. 检测过载副轴线（当敌人过载就绪时，需要防范偏移轴）
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

/**
 * 评估步行抢星的动态安全性（计算我方走路与敌方开火子弹击中星格的时间差）
 */
function getEnemyBulletArrivalTime(pos, ctx) {
    if (!ctx.enemyPos || !ctx.enemyDir) return Infinity;
    var tMin = Infinity;

    // 1. 检测主枪线
    var mainOnAxis = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
    if (mainOnAxis && canShoot(ctx.enemyPos, pos, ctx.map) === true) {
        var mainDist = getDist(ctx.enemyPos, pos);
        if (isLoS(ctx.enemyPos, pos, ctx.enemyDir, ctx.map)) {
            tMin = Math.min(tMin, Math.ceil(mainDist / 2));
        } else {
            tMin = Math.min(tMin, 1 + Math.ceil(mainDist / 2)); // 需要 1 帧转向
        }
    }

    // 2. 检测过载副枪线
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
    // 任何时候，抢星目标格必须首先满足严格安全性（避开敌人枪口和超载覆盖），防止抢先踩点却被卡死在死角
    if (!isSafe(pos, ctx, true)) return false;

    var myDist = getDist(ctx.myPos, pos);

    var enemyDist = getDist(ctx.predictedEnemyPos || ctx.enemyPos, pos);

    // Calculate enemy bullet arrival time at the star
    var T_bullet = getEnemyBulletArrivalTime(pos, ctx);

    // Calculate our arrival time at the star based purely on physical distance
    // to prevent safety evaluation oscillation when our tank turns around
    var T_me = myDist;

    // If we can reach it before their bullet can hit it, it's safe
    var requiredBuffer = ctx.canTeleport ? 0 : 1;
    if (T_me + requiredBuffer < T_bullet) {
        if (enemyDist <= 3) return false;
        var bulletFH = getFramesToHit(pos, ctx.enemyBullet, ctx.map);
        if (bulletFH <= T_me) return false;
        return true;
    } else {
        // 新增安全阈值保护：如果不能确保在对方子弹前抢先拿星，且敌人能够打到该星格
        if (T_bullet !== Infinity) {
            // 在我方领先或平局状态下，安全第一，绝对不抢这颗来不及的星
            if (ctx.meStars >= ctx.enemyStars) {
                return false;
            }
        }
    }

    return isSafe(pos, ctx, true);
}

/**
 * 评估隐身战中目标格是否满足安全逃生间距
 */
function isSafeForAntiCloak(pos, ctx) {
    if (!ctx.enemyPos) return true;
    var d = getDist(pos, ctx.enemyPos);
    var onAxis = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
    if (onAxis && d <= 12 && canShoot(ctx.enemyPos, pos, ctx.map) === true) return false;
    if (ctx.enemyCloaked && d <= 6) return false;
    return true;
}

/**
 * A* 寻路核心实现（计入转向耗时、土堆惩罚、不安全轨道和飞行子弹迎头避让）
 */
function aStar(start, goal, ctx) {
    // 帧内缓存：同一帧对相同 (start,goal,enemyVisible) 的寻路结果直接复用
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
                    // 近距离（≤5格）枪口 LoS 直线格（含超载枪线）：大幅提升代价（近似禁止但保留兜底）
                    var isCloseLoS = ctx.enemyVisible && !ctx.enemyFireLocked && ctx.enemyPos &&
                        getDist(next, ctx.enemyPos) <= 5 &&
                        !G_Blueprint.mapVision.grass[next[0] + "," + next[1]] &&
                        isOnEnemyGunLine(next, ctx, true);
                    cost += isCloseLoS ? 9000 : t.ASTAR_UNSAFE_PENALTY;
                }

                // Smart Bullet Axis Penalty
                if (ctx.enemyBullet && isLoS(ctx.enemyBullet.position, next, ctx.enemyBullet.direction, ctx.map)) {
                    var dOld = getDist(curr.pos, ctx.enemyBullet.position);
                    var dNew = getDist(next, ctx.enemyBullet.position);
                    if (dNew < dOld) cost += 5000; // Penalize moving towards it
                    else cost += 1000; // Penalize staying on axis
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


// --- [5. 工具库] ---



/**
 * 执行系统生成的具体战术动作指令（转向、移动、火控、传送及卡死闪避）
 */
function executeAction(me, act, ctx) {
    if (!act) return;

    // 1. 更新卡死计数器：仅在上一帧尝试迈步位移且实际坐标没有改变时才累加
    if (G_History.lastAttemptedStep && G_History.lastPos && samePos(ctx.myPos, G_History.lastPos)) {
        G_History.stuckTurnCount++;
    } else {
        G_History.stuckTurnCount = 0;
    }
    G_History.lastPos = ctx.myPos.slice();

    // 2. 保存行为类型用于高层决策惯性
    if (act.type) {
        G_History.lastActionType = act.type;
    }

    // 3. 原地卡死 4 帧以上的强制传送脱困机制（对所有动作均有效）
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
            me.speak("卡死强制传送脱困");
            return;
        }
    }

    // 4. 执行具体行动
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
                me.speak("近距危险");
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

/**
 * 提取 A* 寻路当前帧需要迈出的第一步，并对不安全前行路径执行阻断拦截
 */
function getNextStep(start, goal, ctx) {
    if (samePos(start, goal)) {
        G_History.path = [];
        G_History.pathTarget = null;
        return null;
    }

    var useCache = false;
    if (G_History.path && G_History.path.length > 0 && samePos(G_History.pathTarget, goal)) {
        // 如果当前位置已经到达了路径的第一个节点，就把它弹出，迈向下一个节点
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
        // 放宽空地阻断：如果当前位置不是草丛，且无5帧内即击中子弹威胁，不执行待机阻断
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

/**
 * 寻找偏轴避让格（让出轴线、避开盲区共轴射线并朝星星微调偏头）
 */
function findOffAxisMove(ctx) {
    var neighbors = ["up", "right", "down", "left"], best = null, maxS = -1;
    for (var i = 0; i < neighbors.length; i++) {
        var dir = neighbors[i];
        var n = addPos(ctx.myPos, delta(dir));
        if (isPassable(n, ctx.map)) {
            // 1步避险评估
            if (isSafe(n, ctx, false)) {
                var s = getDist(n, ctx.enemyPos);
                var isNeighborOnAxis = (n[0] === ctx.enemyPos[0] || n[1] === ctx.enemyPos[1]);
                if (!isNeighborOnAxis) s += 0.5;
                if (directionTo(ctx.myPos, n) === ctx.myDir) s += 0.1;
                if (ctx.starPos) {
                    s += Math.max(0, (50 - getDist(n, ctx.starPos)) * 0.001);
                }

                // 【过载非对称避弹加分】：主弹道优先向 x-1/y-1 避，副弹道优先向 x+2/y+2 避
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
                    if (isSafeSide) s += 0.1;
                }

                if (s > maxS) { maxS = s; best = n; }
            }
            // 2步避险评估（针对敌方超载且第1步在超载枪线上的情况）
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
                    s -= 2.0; // 双格避险惩罚分，确保优先选择安全的单格避险

                    // 【过载非对称避弹加分】：主弹道优先向 x-1/y-1 避，副弹道优先向 x+2/y+2 避（针对落点 n2 评估）
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
                        if (isSafeSide) s += 0.1;
                    }

                    if (s > maxS) { maxS = s; best = n; }
                }
            }
        }
    }
    return best ? { action: "move", target: best, score: 25000 } : null;
}

/**
 * 寻找远离敌人、绝对安全的草丛格子用于隐蔽
 */
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
        if (isSafe(p, ctx, true) && getDist(p, ctx.enemyPos) > 10) grass.push(p);
    }
    if (grass.length === 0) return null;
    grass.sort(function (a, b) { return getDist(b, ctx.enemyPos) - getDist(a, ctx.enemyPos); });
    return grass[0];
}

/**
 * 寻找物理距离上最近的静态草丛格
 */
function findNearestGrass(pos) {
    var best = null, minDist = 999;
    var list = G_Blueprint.mapVision.grassList || [];
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var d = getDist(pos, p); if (d < minDist) { minDist = d; best = p; }
    }
    return best;
}

/**
 * 寻找距离最近且安全的草丛格子（排除敌人贴身区域）
 */
function findNearestSafeGrass(pos, ctx) {
    var best = null, minDist = 999;
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
        if (!isSafe(p, ctx, true)) continue;
        if (ctx.enemyPos && getDist(p, ctx.enemyPos) <= 2) continue;
        var d = getDist(pos, p);
        if (d < minDist) { minDist = d; best = p; }
    }
    return best;
}

/**
 * 视线追踪（LoS）：在给定的朝向上，起点和终点之间是否没有任何硬墙和土堆遮挡
 */
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

/**
 * 直线射击轨道畅通性测试，返回 true（直通）、"mound"（阻挡 1 土堆）或 false（硬墙）
 */
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

/**
 * 搜索敌方背后或侧面 5 格草丛的安全暗杀落点，或预测敌方两帧后的前行落点
 */
function findAssassinSpot(ctx) {
    var e = ctx.enemyPos;
    var candidates = [];
    var dist = 5; // 平台新机制下落地暴露，强制只允许 5 格安全防爆极限距离暗杀
    var offsets = getAssassinOffsets(ctx.enemyDir, dist);

    // 1. 评估当前位置暗杀
    for (var i = 0; i < offsets.length; i++) {
        var p = addPos(e, offsets[i]);
        if (isPassable(p, ctx.map) && canShoot(p, e, ctx.map) === true && isSafe(p, ctx, false, true)) {
            // 物理安全防爆隔离：落点与敌人最后真实目击位置距离必须 ≥ 5，防止预测偏差空降贴脸
            if (G_History.lastEnemyPos && getDist(p, G_History.lastEnemyPos) < 5) continue;

            var isGrass = G_Blueprint.mapVision.grass[p[0] + "," + p[1]] ? 1 : 0;
            var score = isGrass * 1000 - dist * 100 - i;

            // 朝向对齐奖励
            if (ctx.myDir === directionTo(p, e)) {
                score += 300;
            }

            candidates.push({ pos: p, score: score });
        }
    }

    // 2. 预测未来位置暗杀
    if (ctx.enemyDir) {
        var ed = delta(ctx.enemyDir);
        var predE = addPos(e, [ed[0] * 2, ed[1] * 2]);
        if (isPassable(predE, ctx.map) && isPassable(addPos(e, ed), ctx.map)) {
            for (var i = 0; i < offsets.length; i++) {
                var p = addPos(predE, offsets[i]);
                if (isPassable(p, ctx.map) && canShoot(p, predE, ctx.map) === true && isSafe(p, ctx, true, true)) {
                    // 物理安全防爆隔离：落点与敌人最后真实目击位置距离必须 ≥ 5，防止预测偏差空降贴脸
                    if (G_History.lastEnemyPos && getDist(p, G_History.lastEnemyPos) < 5) continue;

                    var isGrass = G_Blueprint.mapVision.grass[p[0] + "," + p[1]] ? 1 : 0;
                    var score = isGrass * 1000 - dist * 100 - i - 50;

                    // 朝向对齐奖励
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

// 根据敌方朝向返回 4 个 offset，背后优先
/**
 * 依据敌方朝向获取四向暗杀偏移量列表（背后优先，其次左右，最后正面）
 */
function getAssassinOffsets(enemyDir, dist) {
    var d = enemyDir || "up";
    var s = dist || 5;
    if (d === "up") return [[0, s], [-s, 0], [s, 0], [0, -s]];  // 背后(下) > 左右 > 正面(上)
    if (d === "down") return [[0, -s], [-s, 0], [s, 0], [0, s]];  // 背后(上) > 左右 > 正面(下)
    if (d === "left") return [[s, 0], [0, -s], [0, s], [-s, 0]];  // 背后(右) > 上下 > 正面(left)
    if (d === "right") return [[-s, 0], [0, -s], [0, s], [s, 0]];  // 背后(左) > 上下 > 正面(right)
    return [[-s, 0], [s, 0], [0, -s], [0, s]];
}

/**
 * 计算敌人在前行轨道上与我方产生共轴的角度方向（用于草丛伏击提前转向）
 */
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

/**
 * 寻找安全象限的角落作为逃跑点（用于紧急避险）
 */
function findSafeQuadrantSpot(ctx) {
    var e = ctx.enemyPos, q = [ctx.myPos[0] < e[0] ? 2 : 17, ctx.myPos[1] < e[1] ? 2 : 12];
    if (isPassable(q, ctx.map) && isSafe(q, ctx, true)) return q;
    return findEscapeSpot(ctx);
}

/**
 * 在自身周围 5 格范围内寻找一个可以快速逃跑的安全格子
 */
function findEscapeSpot(ctx) {
    var offs = [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 4], [-4, -4]];
    for (var i = 0; i < offs.length; i++) {
        var p = addPos(ctx.myPos, offs[i]); if (isPassable(p, ctx.map) && isSafe(p, ctx, false)) return p;
    }
    return null;
}

/**
 * 物理避弹选择器，寻找周围能最大化延迟敌方子弹碰撞的邻格
 */
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

/**
 * 计算飞行中的子弹需要多少帧能打中指定位置
 */
function getFramesToHit(pos, bullet, map) {
    if (!bullet) return Infinity;
    if (isLoS(bullet.position, pos, bullet.direction, map)) return Math.ceil(getDist(pos, bullet.position) / 2);
    return Infinity;
}

/**
 * 计算两点坐标的曼哈顿距离
 */
function getDist(a, b) { if (!a || !b) return 999; return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }
/**
 * 判断两个坐标 [x, y] 是否一致
 */
function samePos(a, b) { return a && b && a[0] === b[0] && a[1] === b[1]; }
/**
 * 坐标叠加运算 [x1 + x2, y1 + y2]
 */
function addPos(p, d) { return [p[0] + d[0], p[1] + d[1]]; }
/**
 * 将坐标格式化为字符串 Key 用于字典映射
 */
function key(p) { return p[0] + "," + p[1]; }
/**
 * 获取方向字符串对应的二维坐标偏移向量
 */
function delta(d) { return { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d] || [0, 0]; }
/**
 * 计算从坐标 a 到坐标 b 对应的绝对朝向字符串
 */
function directionTo(a, b) { if (b[0] > a[0]) return "right"; if (b[0] < a[0]) return "left"; if (b[1] > a[1]) return "down"; return "up"; }
/**
 * 获取给定方向的反方向朝向字符串
 */
function reverseDir(d) { return { up: "down", down: "up", left: "right", right: "left" }[d]; }
/**
 * 获取给定方向的 Overload 右偏方向朝向字符串(超载子弹的偏移方向)
 */
function overloadRightDir(d) { return { up: "right", right: "down", down: "right", left: "down" }[d]; }
/**
 * 检查某点是否不是硬墙或土堆，可用于物理穿行
 */
function isPassable(p, map) { if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return false; var t = map[p[0]][p[1]]; return t !== "x" && t !== "m"; }
/**
 * 检查瞬移点是否可行，防止 15 帧内重复向失败落点传送死锁
 */
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
/**
 * 获取指定地图格子的静态类型（硬墙 x、土堆 m、草丛 o、空地 .）
 */
function getTile(p, map) { if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return null; return map[p[0]][p[1]]; }
/**
 * 原生转向控制重映射函数，规避平台不支持绝对朝向转向的 Bug，并智能挑选远离敌方的侧向进行缓冲转向
 */
function getTurnDir(currentDir, targetDir, enemyPos, myPos, map) {
    if (!targetDir || currentDir === targetDir) return null;
    var dirs = ["up", "right", "down", "left"];
    var curIdx = dirs.indexOf(currentDir);
    var tarIdx = dirs.indexOf(targetDir);
    if (curIdx === -1 || tarIdx === -1) return null;
    var diff = (tarIdx - curIdx + 4) % 4;
    if (diff === 1) return "right";
    if (diff === 3) return "left";

    // diff === 2 (180 degrees turn): Avoid turning towards the enemy if possible
    if (enemyPos && myPos) {
        var dirToEnemy = directionTo(myPos, enemyPos);
        var intermediateRight = dirs[(curIdx + 1) % 4];
        var intermediateLeft = dirs[(curIdx + 3) % 4];

        // 引入物理通行性校验，避开墙壁
        var pRight = addPos(myPos, delta(intermediateRight));
        var pLeft = addPos(myPos, delta(intermediateLeft));
        var rightPassable = isPassable(pRight, map);
        var leftPassable = isPassable(pLeft, map);

        if (rightPassable && !leftPassable) return "right";
        if (!rightPassable && leftPassable) return "left";

        // 两侧都可行或都不可行时，再回退到防直面敌人朝向的避让策略
        if (intermediateRight === dirToEnemy) return "left";
        if (intermediateLeft === dirToEnemy) return "right";
    }
    return "right";
}

/**
 * 记录最近避险逃生发出的格子，锁定3帧防折返
 */
function recordDodgeSource(pos) {
    if (!pos) return;
    if (!G_History.recentDodgeSource) {
        G_History.recentDodgeSource = {};
    }
    var key = pos[0] + "," + pos[1];
    G_History.recentDodgeSource[key] = G_History.frame;
}

/**
 * 判断格子自身及四周相邻格子中是否至少有一个是草丛
 */
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

/**
 * 寻找草丛盲射的目标格子，用于压制在草丛中丢失视野的敌人
 */
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

/**
 * 计算最适宜瞬移的星星相邻安全格子（优先选择草丛及能直接前进吃星的格子）
 */
function findBestStarTeleportTarget(ctx) {
    if (!ctx.starPos) return null;
    var star = ctx.starPos;
    // 4相邻格子: 上、下、左、右
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
            // 1. 优先选择安全草丛
            if (G_Blueprint.mapVision.grass[p[0] + "," + p[1]]) {
                score += 10;
            }
            // 2. 其次不用转向直接能前进吃星的方向
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

/**
 * 寻找星星附近 6 格范围内，位于视线轨道上的最佳伏击草丛
 */
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

/**
 * 沿着当前直射枪线扫描特定距离内的第一个可用草丛格子
 */
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

/**
 * 刺杀预瞄动作评估：在传送冷却即将归零的倒数第 1 帧，若确定子弹就绪且暗杀路线安全，提前原地转向对齐击杀轨道
 * @param {Object} ctx 动态上下文
 */
function evalAssassinationPreAim(ctx) {
    if (!ctx.enemyPos || (ctx.enemy && ctx.enemy.status && ctx.enemy.status.shielded)) return null;
    if (ctx.enemyCloaked && !ctx.enemyFireLocked) return null;

    // 新增：预瞄前必须确保我方子弹与火控均就绪
    if (ctx.me.bullet || ctx.meStatus.fireLocked) return null;

    var cooldown = ctx.me.skill ? ctx.me.skill.remainingCooldownFrames : 99;
    var isPreAimFrame = false;
    if (cooldown === 1) {
        isPreAimFrame = true;
    } else if (cooldown === 0) {
        var isTeleportAmbushStream = G_History.isAmbushStreamDetected && G_History.enemyInvisibleFrames === 4;
        if (isTeleportAmbushStream) {
            isPreAimFrame = true;
        }
    }
    if (!isPreAimFrame) return null;

    var isEnemyAmbushing = !ctx.enemyVisible && ctx.enemy && ctx.enemy.skill && ctx.enemy.skill.type === "teleport" && ctx.enemy.skill.remainingCooldownFrames > 0;

    if (ctx.enemyFireLocked || isEnemyAmbushing || (ctx.meStars < ctx.enemyStars && !ctx.enemySkillReady)) {
        if (isEnemyAmbushing && ctx.enemyPos) {
            var enemyInGrass = G_Blueprint.mapVision && G_Blueprint.mapVision.grass[ctx.enemyPos[0] + "," + ctx.enemyPos[1]];
            if (!enemyInGrass) return null;
        }
        var spot = findAssassinSpot(ctx);
        if (spot && !samePos(spot, ctx.myPos) && isPassable(spot, ctx.map) && isSafeForStarTeleport(spot, ctx, true)) {
            var fireDir = directionTo(spot, ctx.enemyPos);
            if (ctx.myDir !== fireDir) {
                ctx.me.speak("刺杀预瞄");
                return { action: "turn", target: addPos(ctx.myPos, delta(fireDir)), score: CONFIG.KILL_PRIO - 50, type: "assassinate" };
            }
        }
    }
    return null;
}

/**
 * 核心开火控制器，强制检查子弹数量和火控锁，并记录预判射击的防抖历史
 */
function fireGun(me, ctx) {
    if (!me.bullet && !ctx.meStatus.fireLocked) {
        me.fire();
        if (G_History.isEnemyPosPredicted && ctx.shootingEnemyPos) {
            if (isPositionOnGunLine(ctx.myPos, ctx.myDir, ctx.shootingEnemyPos, ctx.map)) {
                var spotKey = ctx.shootingEnemyPos[0] + "," + ctx.shootingEnemyPos[1];
                if (!G_History.firedPredictedSpots) G_History.firedPredictedSpots = {};
                G_History.firedPredictedSpots[spotKey] = true;
                me.speak("射击压制: [" + spotKey + "]");
            }
        }
    }
}

/**
 * 判断给定目标点是否在自身的直射轨道和 LoS 枪线上
 */
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

/**
 * 重新估算并更新针对隐身或在草丛中敌方的埋伏预测格
 */
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

/**
 * 缓存子弹飞行轨迹与可能相撞帧数，用于全局 O(1) 物理避弹字典查询，降低寻路 CPU 开销
 */
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

/**
 * 线性扫描单颗子弹的未来弹道，将相撞帧数标记在全局哈希表中
 */
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