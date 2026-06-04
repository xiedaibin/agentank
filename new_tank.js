/**
 * AgenTank AI Agent - XDB (Strategic Assassin V12.41 - Overload 3-Wide Gun Line Fix)
 * V12.41: 修复 overload 枪线宽度判断——之前只检查主线+右偏（2格），
 * 根据 STRATEGY.md overload 为 3 格宽（左偏+主线+右偏），
 * 补全左偏线检测，防止 [13,6] 类型的左侧被击中场景。
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
    cloakFramesLeft: 0, postTeleportFrames: 0, frame: 0,
    defenseLockTicks: 0, lastDefenseTarget: null,
    path: [], pathTarget: null, stuckTurnCount: 0, lastPos: null,
    lastEnemyOverloadedFrame: null,
    killModeActive: false,  // 单挑期落后≥2星时触发，一旦开启延续到局结束
    starsAt120: null,       // 记录第120帧的我方与敌方星星数
    lastEnemyStars: 0       // 记录敌人的最新已知星星数
};

var CONFIG = { KILL_PRIO: 10000, STAR_PRIO: 800, TURN_COST: 0.8 };

function onIdle(me, enemy, game) {
    try {
        var originalTurn = me.turn;
        me.turn = function (dir) {
            var turnDir = getTurnDir(me.tank.direction, dir);
            if (turnDir) {
                originalTurn.call(me, turnDir);
            }
        };

        G_History.frame = game.frames || 0;

        // 更新敌方的最新已知星星数量
        if (enemy) {
            G_History.lastEnemyStars = enemy.stars || 0;
        }
        if (game.enemies && game.enemies.length > 0) {
            for (var i = 0; i < game.enemies.length; i++) {
                var e = game.enemies[i];
                if (e && e.stars !== undefined && e.stars > G_History.lastEnemyStars) {
                    G_History.lastEnemyStars = e.stars;
                }
            }
        }

        var target = chooseMainTarget(me, enemy, game);

        if (target && target.status && target.status.overloaded) {
            G_History.lastEnemyOverloadedFrame = G_History.frame;
        }
        if (G_History.frame <= 1 && !G_History.hasSpokenInit) {
            me.speak("V13.1: Raid StarChase");
            G_History.hasSpokenInit = true;
        }
        // 单挑期且场上有星：首次进入时播报 StarChase 模式
        if ((game.alivePlayers || 2) <= 2 && game.star && !G_History.spokenStarChase) {
            me.speak("StarChase Mode");
            G_History.spokenStarChase = true;
        }
        if (G_History.postTeleportFrames > 0) G_History.postTeleportFrames--;
        if (G_History.cloakFramesLeft > 0) G_History.cloakFramesLeft--;
        if (!G_Blueprint.initialized || (target && !G_Blueprint.enemySeen)) strategicInit(target, game.map);

        var ctx = buildExecutionContext(me, target, game);

        // 120帧星星记录器
        if (G_History.frame >= 120 && !G_History.starsAt120) {
            G_History.starsAt120 = {
                me: ctx.meStars,
                enemy: G_History.lastEnemyStars
            };
            me.speak("Rec120: " + G_History.starsAt120.me + "-" + G_History.starsAt120.enemy);
        }

        // Kill Mode 触发检测：单挑期落后≥2星，或者120帧及以后落后，或者150帧及以后平局或落后（不可逆，支持出击混战期）
        if (!G_History.killModeActive) {
            var enemyStars = G_History.lastEnemyStars;
            var isSevereBehind = (ctx.alivePlayers <= 2 && ctx.meStars <= enemyStars - 2);
            var isTimeTrigger = (G_History.frame >= 120 && ctx.meStars < enemyStars);
            var isExtremeTimeoutTied = (G_History.frame >= 150 && ctx.meStars <= enemyStars);
            if (isSevereBehind || isTimeTrigger || isExtremeTimeoutTied) {
                G_History.killModeActive = true;
                me.speak("Kill Mode: All-In!");
            }
        }
        ctx.killMode = G_History.killModeActive;

        if (ctx.meStatus.stunned || ctx.meStatus.frozen) return;

        // 1. 绝杀与 Mound 压制
        if (ctx.enemyVisible && !ctx.enemyShielded) {
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
                        me.fire(); return;
                    }
                }
            }
        }

        // 1.5. 草丛盲射 (Blind Fire)
        if (!ctx.enemyVisible && ctx.wasEnemyVisible && G_History.lastEnemyPos) {
            var prevPos = G_History.lastEnemyPos;
            if (isNearGrass(prevPos)) {
                var targetGrass = findTargetGrassForBlindFire(ctx.myPos, ctx.myDir, prevPos, ctx.map);
                if (targetGrass && !me.bullet && !ctx.meStatus.fireLocked) {
                    me.speak("Blind Fire");
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
        G_Blueprint.enemyProfile = {
            skillType: sType,
            hasOverload: (sType === "overload")
        };
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
    var w = map.length, h = map[0].length, v = { width: w, height: h, cover: {}, grass: {}, trapped: {}, componentIds: {} };
    for (var x = 0; x < w; x++) {
        for (var y = 0; y < h; y++) {
            var tile = map[x][y];
            if (tile === "x") v.cover[x + "," + y] = true;
            if (tile === "o") v.grass[x + "," + y] = true;
        }
    }

    var visited = {};
    var compCount = 0;
    for (var x = 0; x < w; x++) {
        for (var y = 0; y < h; y++) {
            var key = x + "," + y;
            var tile = map[x][y];
            if (tile !== "x" && tile !== "m" && !visited[key]) {
                var component = [];
                var queue = [[x, y]];
                visited[key] = true;
                var head = 0;
                while (head < queue.length) {
                    var curr = queue[head++];
                    component.push(curr);
                    var dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
                    for (var i = 0; i < dirs.length; i++) {
                        var nx = curr[0] + dirs[i][0];
                        var ny = curr[1] + dirs[i][1];
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            var nTile = map[nx][ny];
                            var nKey = nx + "," + ny;
                            if (nTile !== "x" && nTile !== "m" && !visited[nKey]) {
                                visited[nKey] = true;
                                queue.push([nx, ny]);
                            }
                        }
                    }
                }
                compCount++;
                for (var i = 0; i < component.length; i++) {
                    var p = component[i];
                    v.componentIds[p[0] + "," + p[1]] = compCount;
                }
                if (component.length <= 5) {
                    for (var i = 0; i < component.length; i++) {
                        var p = component[i];
                        v.trapped[p[0] + "," + p[1]] = true;
                    }
                }
            }
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

    if (G_History.lastUpdatedFrame !== G_History.frame) {
        G_History.wasEnemyVisible = G_History.lastEnemyVisible;
        G_History.lastEnemyVisible = visible;
        G_History.lastUpdatedFrame = G_History.frame;
    }

    if (visible) {
        G_History.lastEnemyPos = eTank.position; G_History.lastEnemyDir = eTank.direction; G_History.lastEnemySeenFrame = G_History.frame;
    }

    updateEnemiesHistory(enemy, game);

    var unsafeCoAxialTiles = {};
    for (var idx in G_History.enemies) {
        var hEnemy = G_History.enemies[idx];
        if (!hEnemy.visible && hEnemy.pos && (G_History.frame - hEnemy.frame < 35)) {
            var lastSeen = hEnemy.pos;
            var elapsed = G_History.frame - hEnemy.frame;
            var maxDist = Math.min(5, elapsed + 1);
            var potentialGrass = [];
            for (var k in G_Blueprint.mapVision.grass) {
                var g = k.split(",").map(Number);
                if (getDist(g, lastSeen) <= maxDist) {
                    potentialGrass.push(g);
                }
            }
            var dirs = ["up", "down", "left", "right"];
            var hasOverload = hEnemy.hasOverload;
            for (var i = 0; i < potentialGrass.length; i++) {
                var g = potentialGrass[i];
                for (var j = 0; j < dirs.length; j++) {
                    var dirStr = dirs[j];
                    var d = delta(dirStr);
                    var p = [g[0] + d[0], g[1] + d[1]];
                    var safety = 0;
                    while (safety < 30) {
                        var tile = getTile(p, game.map);
                        if (!tile || tile === "x" || tile === "m") break;
                        if (tile !== "o") {
                            unsafeCoAxialTiles[p[0] + "," + p[1]] = true;
                        }
                        p = [p[0] + d[0], p[1] + d[1]];
                        safety++;
                    }

                    if (hasOverload) {
                        var rightDir = { up: "right", right: "up", down: "left", left: "down" }[dirStr];
                        var rDelta = delta(rightDir);
                        var offsetOrigin = [g[0] + rDelta[0], g[1] + rDelta[1]];
                        var p2 = [offsetOrigin[0] + d[0], offsetOrigin[1] + d[1]];
                        var safety2 = 0;
                        while (safety2 < 30) {
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
    }

    var visibleBullets = getVisibleBullets(enemy, game);

    return {
        me: me, myPos: me.tank.position, myDir: me.tank.direction, meStars: me.stars, meStatus: me.status || {},
        enemy: enemy, enemyPos: G_History.lastEnemyPos, enemyDir: G_History.lastEnemyDir, enemyVisible: visible,
        wasEnemyVisible: G_History.wasEnemyVisible,
        enemyCloaked: G_History.cloakFramesLeft > 0,
        enemySkillReady: enemy && enemy.skill && enemy.skill.remainingCooldownFrames === 0,
        enemyFireLocked: enemy && enemy.status && enemy.status.fireLocked,
        enemyShielded: enemy && enemy.status && enemy.status.shielded,
        enemyBullet: enemy ? enemy.bullet : null, starPos: game.star, map: game.map,
        canTeleport: me.skill && me.skill.remainingCooldownFrames === 0,
        unsafeCoAxialTiles: unsafeCoAxialTiles,
        visibleBullets: visibleBullets,
        trackedEnemies: G_History.enemies,
        alivePlayers: game.alivePlayers || 2
    };
}

function tacticalAnalysis(ctx) {
    var candidates = [];
    if (ctx.canTeleport) {
        if (G_Blueprint.Tactics.ENABLE_ASSASSINATION) candidates.push(evalAssassination(ctx));
        if (G_Blueprint.Tactics.STANCE === "ANTI_CLOAK") candidates.push(evalPanicTeleport(ctx));
    }
    // 单挑期敌人贴身（<=2格）时，先尝试安全步行脱离，得分高于转炮（9950 > 9900）
    candidates.push(evalCloseEnemyEscape(ctx));
    candidates.push(evalShooting(ctx));
    candidates.push(evalPreAim(ctx));
    candidates.push(evalStarCollection(ctx));
    candidates.push(evalHunting(ctx));
    candidates.push(evalThreatPreAim(ctx));
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
    // 单挑期：禁止主动传送暗杀（Kill Mode 展开击杀时除外）
    if (ctx.alivePlayers <= 2 && !ctx.killMode) return null;
    if (ctx.enemyCloaked && !ctx.enemyFireLocked) return null;
    if (ctx.enemyFireLocked || (ctx.enemy && ctx.meStars < ctx.enemy.stars && !ctx.enemySkillReady)) {
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
        // 单挑期且场上有星星：将「转炮瞄准」权重压低到 500，让坦克优先去吃星
        // 注：直接顺手开炮（已对准）由 onIdle 第一步处理，不依赖此函数
        // 例外1：敌人贴身（≤2格）时恢复高权重自保
        // 例外2：Kill Mode 启动后恢复全力击杀
        var killScore = CONFIG.KILL_PRIO - 100;
        if (ctx.alivePlayers <= 2 && ctx.starPos && !ctx.killMode) {
            var enemyClose = getDist(ctx.myPos, ctx.enemyPos) <= 2;
            killScore = enemyClose ? (CONFIG.KILL_PRIO - 100) : 500;
        }
        return { action: "turn", target: ctx.enemyPos, score: killScore };
    }
    return null;
}

function evalPreAim(ctx) {
    if (!ctx.enemyPos || !ctx.enemyVisible || !ctx.enemyDir) return null;

    // 单挑期且场上有星星：禁止预瞄转炮，避免浪费行动帧对准敌人
    // 例外1：敌人贴身（≤2格）时恢复高权重自保
    // 例外2：Kill Mode 启动后恢复全力击杀
    if (ctx.alivePlayers <= 2 && ctx.starPos && !ctx.killMode) {
        var enemyClose = getDist(ctx.myPos, ctx.enemyPos) <= 2;
        if (!enemyClose) return null;
    }

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

// 单挑期贴身逃跑：当敌人 <=2 格时，优先找安全相邻格步行脱离，而非硬刚转炮
// Kill Mode 下禁用（正面硬刚，不逃跑）
function evalCloseEnemyEscape(ctx) {
    if (!ctx.enemyPos || !ctx.enemyVisible) return null;
    if (!(ctx.alivePlayers <= 2 && ctx.starPos)) return null;
    if (ctx.killMode) return null;  // Kill Mode 不逃
    if (getDist(ctx.myPos, ctx.enemyPos) > 2) return null;

    var dirs = ["up", "down", "left", "right"];
    var safeTiles = [];
    for (var i = 0; i < dirs.length; i++) {
        var np = addPos(ctx.myPos, delta(dirs[i]));
        // 不能踩到敌人格
        if (samePos(np, ctx.enemyPos)) continue;
        // 必须可行走且安全
        var tile = getTile(np, ctx.map);
        if (!tile || tile === "x" || tile === "m") continue;
        if (!isSafe(np, ctx, true)) continue;
        safeTiles.push(np);
    }
    if (safeTiles.length === 0) return null;

    // 优先选不在对方当前朝向 LoS 上的格子
    var best = null;
    for (var j = 0; j < safeTiles.length; j++) {
        if (!isLoS(ctx.enemyPos, safeTiles[j], ctx.enemyDir, ctx.map)) {
            best = safeTiles[j]; break;
        }
    }
    if (!best) best = safeTiles[0];

    return { action: "move", target: best, score: 9950, tag: "CloseEsc" };
}

function evalStarCollection(ctx) {
    if (!ctx.starPos) return null;
    var dist = getDist(ctx.myPos, ctx.starPos);

    var score = CONFIG.STAR_PRIO - dist;
    if (G_History.frame < 80) score += 600;
    if (ctx.enemy && ctx.meStars <= ctx.enemy.stars) score += 400;

    var isSingleEnemy = ctx.alivePlayers <= 2;
    if (!isSingleEnemy) {
        // Multiple enemies: play extremely safe, suppress star collection
        score -= 800;
    } else {
        // Only 1 enemy left: boost star collection priority score to collect treasures safely
        score += 500;
    }

    var myComp = G_Blueprint.mapVision.componentIds[ctx.myPos[0] + "," + ctx.myPos[1]];
    var starComp = G_Blueprint.mapVision.componentIds[ctx.starPos[0] + "," + ctx.starPos[1]];
    var isUnreachable = (myComp !== undefined && starComp !== undefined && myComp !== starComp);

    var safeForTeleport = isSafeForStarTeleport(ctx.starPos, ctx);
    var shouldTeleport = ctx.canTeleport && safeForTeleport && (
        (dist > 7 && isSingleEnemy) || isUnreachable
    );

    if (shouldTeleport) {
        return { action: "teleport", target: ctx.starPos, score: CONFIG.STAR_PRIO + 1000 + 500 };
    }

    var safeForWalking = isSafeForStarWalking(ctx.starPos, ctx);
    if (!safeForWalking) score = Math.min(score - 1200, -500);
    return { action: "move", target: ctx.starPos, score: score };
}

function evalGrassAmbushAndSurvival(ctx) {
    if (ctx.alivePlayers <= 2) return null; // 单挑模式下关闭进入草丛策略

    var isCurrentlyInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
    var grass = findNearestSafeGrass(ctx.myPos, ctx);

    if (grass) {
        var starUnsafe = ctx.starPos && !isSafeForStarWalking(ctx.starPos, ctx);
        var score = 300;

        // Priority adjustment for bullet danger
        //if (ctx.enemyBullet && getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map) < 10) score -= 1000;

        if (isCurrentlyInGrass && (!ctx.starPos || starUnsafe)) {
            // 检查当前草丛位置是否处于任何敌人的枪线上或有子弹袭来，禁止在对方枪线草丛中待机
            var onAnyGunLine = false;
            if (ctx.trackedEnemies) {
                for (var idx in ctx.trackedEnemies) {
                    var hEnemy = ctx.trackedEnemies[idx];
                    if (hEnemy && hEnemy.pos) {
                        var elapsed = G_History.frame - hEnemy.frame;
                        if ((hEnemy.visible || elapsed < 35) && isOnEnemyGunLineForTracked(ctx.myPos, hEnemy, ctx, true)) {
                            onAnyGunLine = true;
                            break;
                        }
                    }
                }
            }
            var bulletIncoming = getMinFramesToHit(ctx.myPos, ctx.visibleBullets, ctx.map) <= 5;

            if (onAnyGunLine || bulletIncoming) {
                // 不在此处 return，让它fall-through到下面的grass寻路以寻找安全草丛
            } else {
                if (ctx.enemyVisible && canShoot(ctx.myPos, ctx.enemyPos, ctx.map) === true) {
                    var d = directionTo(ctx.myPos, ctx.enemyPos);
                    if (ctx.myDir === d) return { action: "move", target: ctx.myPos, score: score + 100 };
                    if (ctx.enemyDir !== reverseDir(d)) return { action: "turn", target: ctx.enemyPos, score: score + 50 };
                }
                return { action: "move", target: ctx.myPos, score: score };
            }
        }

        score = 250 - getDist(ctx.myPos, grass) * 10;
        if (!ctx.starPos || starUnsafe) score += 550;
        //if (ctx.enemyBullet && getFramesToHit(ctx.myPos, ctx.enemyBullet, ctx.map) < 10) score -= 1000;

        return { action: "move", target: grass, score: score };
    }

    // Default survival fallback
    var esc = findSafeGrassSpot(ctx) || findEscapeSpot(ctx) || [9, 7];
    return { action: "move", target: esc, score: 100 };
}

function evalHunting(ctx) {
    if (!ctx.killMode || !ctx.enemyPos) return null;
    return { action: "move", target: ctx.enemyPos, score: 750 }; // 优先级高于躲草丛与低分吃星
}

function getNearestEnemyPos(ctx) {
    var nearestPos = null;
    var minDist = 999;
    if (ctx.trackedEnemies) {
        for (var idx in ctx.trackedEnemies) {
            var hEnemy = ctx.trackedEnemies[idx];
            if (hEnemy && hEnemy.pos) {
                var d = getDist(ctx.myPos, hEnemy.pos);
                if (d < minDist) {
                    minDist = d;
                    nearestPos = hEnemy.pos;
                }
            }
        }
    }
    if (!nearestPos && ctx.enemyPos) {
        nearestPos = ctx.enemyPos;
    }
    return nearestPos;
}

function evalThreatPreAim(ctx) {
    if (ctx.starPos) return null; // 场上有星时优先抢星，不预瞄转向

    var nearestEnemyPos = getNearestEnemyPos(ctx);
    if (!nearestEnemyPos) return null;

    var dir = directionTo(ctx.myPos, nearestEnemyPos);
    if (ctx.myDir !== dir) {
        var targetPos = addPos(ctx.myPos, delta(dir));
        return { action: "turn", target: targetPos, score: 350 }; // 评分设为350，高于草丛停驻的分数300，使其待机时自动转头
    }
    return null;
}

// 单挑期逃跑优先目标：若星星安全则用传送吃星代替传送去草丛（一举两得）
function getBestEscapeTarget(me, ctx) {
    if (ctx.alivePlayers <= 2 && ctx.starPos && isSafeForStarTeleport(ctx.starPos, ctx)) {
        return ctx.starPos;
    }
    return findSafeGrassSpot(ctx) || findEscapeSpot(ctx);
}

function tacticalDefense(me, ctx) {
    var minFH = getMinFramesToHit(ctx.myPos, ctx.visibleBullets, ctx.map);
    if (minFH <= 5) {
        var dodge = findBestDodge(ctx, minFH);
        if (ctx.canTeleport && (minFH <= 2 || !dodge)) {
            var esc = getBestEscapeTarget(me, ctx);
            if (esc) return { action: "teleport", target: esc, score: 99999 };
        }
        if (dodge) {
            G_History.defenseLockTicks = 2;
            G_History.lastDefenseTarget = dodge;
            return { action: "move", target: dodge, score: 99999 };
        }
    }

    // Ghost bullet prediction check
    if (!ctx.visibleBullets || ctx.visibleBullets.length === 0) {
        if (ctx.trackedEnemies) {
            for (var idx in ctx.trackedEnemies) {
                var hEnemy = ctx.trackedEnemies[idx];
                if (!hEnemy || !hEnemy.pos || hEnemy.fireLocked) continue;
                var recentlySeen = (G_History.frame - hEnemy.frame < 6);
                if (recentlySeen || !hEnemy.visible) {
                    var ghostDist = getDist(ctx.myPos, hEnemy.pos);
                    if (ghostDist <= 7) {
                        var myPosInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
                        if (!myPosInGrass || ghostDist <= 2) {
                            var onOverloadLine = isOnEnemyGunLineForTracked(ctx.myPos, hEnemy, ctx, true);
                            if (onOverloadLine) {
                                var ghostEscape = findOffAxisMoveForEnemy(ctx, hEnemy);
                                if (ghostEscape) {
                                    ghostEscape.score = 22000;
                                    return ghostEscape;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // CoAxial Evasion check
    if (!ctx.visibleBullets || ctx.visibleBullets.length === 0) {
        var myPosInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
        if (!myPosInGrass) {
            if (ctx.unsafeCoAxialTiles && ctx.unsafeCoAxialTiles[ctx.myPos[0] + "," + ctx.myPos[1]]) {
                var ghostEscape = findOffAxisMove(ctx);
                if (ghostEscape) {
                    ghostEscape.score = 22000;
                    return ghostEscape;
                }
            }
        }
    }

    if (G_History.defenseLockTicks > 0 && G_History.lastDefenseTarget) {
        G_History.defenseLockTicks--;
        if (isSafe(G_History.lastDefenseTarget, ctx, true)) return { action: "move", target: G_History.lastDefenseTarget, score: 30000 };
    }

    // General active gun line evasion
    if (ctx.trackedEnemies) {
        for (var idx in ctx.trackedEnemies) {
            var hEnemy = ctx.trackedEnemies[idx];
            if (!hEnemy || !hEnemy.pos || hEnemy.fireLocked) continue;
            var enemySeenRecently = (G_History.frame - hEnemy.frame < 35);
            if (hEnemy.visible || enemySeenRecently) {
                var d = getDist(ctx.myPos, hEnemy.pos);
                var onLine = isOnEnemyGunLineForTracked(ctx.myPos, hEnemy, ctx, true);
                if (onLine && d <= 8) {
                    var myPosInGrass = G_Blueprint.mapVision.grass[ctx.myPos[0] + "," + ctx.myPos[1]];
                    if (!myPosInGrass || d <= 4) {
                        var escape = findOffAxisMoveForEnemy(ctx, hEnemy);
                        if (escape) {
                            escape.score = 25000;
                            return escape;
                        }
                        if (ctx.canTeleport) {
                            var esc = getBestEscapeTarget(me, ctx);
                            if (esc) return { action: "teleport", target: esc, score: 99999 };
                        }
                    }
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

function isEnemyOverloadActive(ctx, pos) {
    if (!G_Blueprint.enemyProfile || !G_Blueprint.enemyProfile.hasOverload) return false;
    var recentlyOverloaded = G_History.lastEnemyOverloadedFrame && (G_History.frame - G_History.lastEnemyOverloadedFrame < 8);
    return (ctx.enemy && ctx.enemy.status && ctx.enemy.status.overloaded) ||
        (ctx.enemySkillReady) ||
        recentlyOverloaded;
}

function isOnEnemyGunLine(pos, ctx, checkOverload) {
    if (!ctx.enemyPos || !ctx.enemyDir) return false;
    if (isLoS(ctx.enemyPos, pos, ctx.enemyDir, ctx.map)) return true;
    if (checkOverload && isEnemyOverloadActive(ctx, pos)) {
        // Overload 枪线为 3 格宽：主线 + 右偏 + 左偏
        var rightDir = { up: "right", right: "down", down: "left", left: "up" }[ctx.enemyDir];
        var leftDir = { up: "left", right: "up", down: "right", left: "down" }[ctx.enemyDir];
        var rightOrigin = addPos(ctx.enemyPos, delta(rightDir));
        var leftOrigin = addPos(ctx.enemyPos, delta(leftDir));
        if (isLoS(rightOrigin, pos, ctx.enemyDir, ctx.map)) return true;
        if (isLoS(leftOrigin, pos, ctx.enemyDir, ctx.map)) return true;
    }
    return false;
}

function isSafe(pos, ctx, strict) {
    if (!pos) return false;
    var fH = getMinFramesToHit(pos, ctx.visibleBullets, ctx.map);
    if (fH <= (strict ? 4 : 2)) return false;

    if (ctx.trackedEnemies) {
        for (var idx in ctx.trackedEnemies) {
            var hEnemy = ctx.trackedEnemies[idx];
            if (!hEnemy || !hEnemy.pos) continue;
            var d = getDist(pos, hEnemy.pos);
            if (hEnemy.visible) {
                if (isOnEnemyGunLineForTracked(pos, hEnemy, ctx, true)) return false;
                var dangerRadius = G_Blueprint.Tactics.DANGER_RADIUS;
                if (hEnemy.skillType === "freeze" || hEnemy.skillType === "stun") dangerRadius = 8;
                if (strict && hEnemy.skillReady && d <= dangerRadius) return false;
                if (d < 2) return false;
            } else {
                var elapsed = G_History.frame - hEnemy.frame;
                if (elapsed < 35) {
                    if (d < 2) return false;
                    if (isOnEnemyGunLineForTracked(pos, hEnemy, ctx, true)) return false;
                    var inGrass = G_Blueprint.mapVision.grass[pos[0] + "," + pos[1]];
                    if (!inGrass) {
                        if (d <= 3) return false;
                        if (pos[0] === hEnemy.pos[0] || pos[1] === hEnemy.pos[1]) {
                            if (canShoot(hEnemy.pos, pos, ctx.map) !== false) return false;
                        }
                        if (ctx.unsafeCoAxialTiles && ctx.unsafeCoAxialTiles[pos[0] + "," + pos[1]]) return false;
                    }
                }
            }
        }
    }
    return true;
}

function isSafeForStarTeleport(pos, ctx) {
    if (!isSafe(pos, ctx, true)) return false;
    // 如果有任何可见子弹正飞向该位置，禁止传送
    if (getMinFramesToHit(pos, ctx.visibleBullets, ctx.map) !== Infinity) return false;

    if (ctx.trackedEnemies) {
        for (var idx in ctx.trackedEnemies) {
            var hEnemy = ctx.trackedEnemies[idx];
            if (!hEnemy || !hEnemy.pos) continue;
            var d = getDist(pos, hEnemy.pos);
            if (d <= 2) return false;
            // 判断是否在对方坦克的潜在直射枪线上（同轴且无障碍物阻挡）
            if (pos[0] === hEnemy.pos[0] || pos[1] === hEnemy.pos[1]) {
                if (canShoot(hEnemy.pos, pos, ctx.map) !== false) {
                    if (d <= 6 && !hEnemy.fireLocked) return false;
                }
            }
        }
    }
    // 常规检查全通过
    return true;
}

function isSafeForStarWalking(pos, ctx) {
    var myDist = getDist(ctx.myPos, pos);
    var T_me = myDist;
    if (directionTo(ctx.myPos, pos) !== ctx.myDir) {
        T_me += 1;
    }

    if (ctx.trackedEnemies) {
        for (var idx in ctx.trackedEnemies) {
            var hEnemy = ctx.trackedEnemies[idx];
            if (!hEnemy || !hEnemy.pos) continue;
            var enemyDist = getDist(hEnemy.pos, pos);

            var T_bullet = Infinity;
            var onAxis = (pos[0] === hEnemy.pos[0] || pos[1] === hEnemy.pos[1]);
            if (onAxis && canShoot(hEnemy.pos, pos, ctx.map) === true) {
                if (isLoS(hEnemy.pos, pos, hEnemy.dir, ctx.map)) {
                    T_bullet = Math.ceil(enemyDist / 2);
                } else {
                    T_bullet = 1 + Math.ceil(enemyDist / 2);
                }
            }

            var requiredBuffer = ctx.canTeleport ? 0 : 1;
            if (T_me + requiredBuffer >= T_bullet) {
                return false;
            }
            if (enemyDist <= 3) return false;
        }
    }

    var bulletFH = getMinFramesToHit(pos, ctx.visibleBullets, ctx.map);
    if (bulletFH <= T_me) return false;

    return isSafe(pos, ctx, true);
}

function isSafeForAntiCloak(pos, ctx) {
    if (ctx.trackedEnemies) {
        for (var idx in ctx.trackedEnemies) {
            var hEnemy = ctx.trackedEnemies[idx];
            if (!hEnemy || !hEnemy.pos) continue;
            var d = getDist(pos, hEnemy.pos);
            var onAxis = (pos[0] === hEnemy.pos[0] || pos[1] === hEnemy.pos[1]);
            if (onAxis && d <= 12 && canShoot(hEnemy.pos, pos, ctx.map) === true) return false;
            var isCloaked = !hEnemy.visible && (hEnemy.skillType === "cloak" || ctx.enemyCloaked);
            if (isCloaked && d <= 6) return false;
        }
    }
    return true;
}

function aStar(start, goal, ctx) {
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
                var isCloseLoS = false;
                var isExtremeLoS = false;
                if (ctx.trackedEnemies) {
                    for (var idx in ctx.trackedEnemies) {
                        var hEnemy = ctx.trackedEnemies[idx];
                        if (hEnemy && hEnemy.pos && !hEnemy.fireLocked) {
                            var elapsed = G_History.frame - hEnemy.frame;
                            var activeThreat = hEnemy.visible || (elapsed < 35);
                            if (activeThreat) {
                                var dist = getDist(next, hEnemy.pos);
                                if (isOnEnemyGunLineForTracked(next, hEnemy, ctx, true)) {
                                    if (dist < 4) {
                                        isExtremeLoS = true;
                                    } else if (dist <= 5) {
                                        isCloseLoS = true;
                                    }
                                }
                            }
                        }
                    }
                }
                if (isExtremeLoS) {
                    cost += 80000;
                } else if (isCloseLoS) {
                    cost += 9000;
                } else if (!isSafe(next, ctx, true)) {
                    cost += t.ASTAR_UNSAFE_PENALTY;
                }

                // Smart Bullet Axis Penalty
                if (ctx.visibleBullets) {
                    for (var k = 0; k < ctx.visibleBullets.length; k++) {
                        var b = ctx.visibleBullets[k];
                        if (isLoS(b.position, next, b.direction, ctx.map)) {
                            var dOld = getDist(curr.pos, b.position);
                            var dNew = getDist(next, b.position);
                            if (dNew < dOld) cost += 5000; // Penalize moving towards it
                            else cost += 1000; // Penalize staying on axis
                        }
                    }
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
    // \u8c03\u8bd5\u6807\u8bb0\uff1a\u82e5 action \u643a\u5e26 tag\uff0c\u5728\u6b64\u8f93\u51fa\uff08me \u5728\u4f5c\u7528\u57df\u5185\uff09
    if (act.tag) me.speak(act.tag);
    if (act.action === "fire") {
        var d = directionTo(ctx.myPos, act.target);
        if (ctx.myDir === d) { if (!me.bullet && !ctx.meStatus.fireLocked) me.fire(); } else me.turn(d);
    }
    else if (act.action === "turn") { me.turn(directionTo(ctx.myPos, act.target)); }
    else if (act.action === "teleport") { me.teleport(act.target[0], act.target[1]); G_History.postTeleportFrames = 8; }
    else if (act.action === "move") {
        if (G_History.lastPos && samePos(ctx.myPos, G_History.lastPos)) G_History.stuckTurnCount++; else G_History.stuckTurnCount = 0;
        G_History.lastPos = ctx.myPos.slice();
        if (G_History.stuckTurnCount >= 30) {
            G_History.stuckTurnCount = 0;
            if (ctx.canTeleport) {
                if (ctx.starPos && isSafeForStarTeleport(ctx.starPos, ctx)) {
                    me.teleport(ctx.starPos[0], ctx.starPos[1]);
                    G_History.postTeleportFrames = 8;
                    return;
                }
                var esc = findSafeGrassSpot(ctx) || findSafeQuadrantSpot(ctx);
                if (esc) {
                    me.teleport(esc[0], esc[1]);
                    G_History.postTeleportFrames = 8;
                    return;
                }
            }
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
    var res = null;
    if (path && path.length > 0) {
        res = path[0];
    } else {
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
    if (res && !isSafe(res, ctx, true) && isSafe(start, ctx, true) && !ctx.killMode) {
        return null;
    }
    return res;
}

function findOffAxisMove(ctx) {
    if (!ctx.enemyPos) {
        var neighbors = ["up", "right", "down", "left"];
        for (var i = 0; i < neighbors.length; i++) {
            var n = addPos(ctx.myPos, delta(neighbors[i]));
            if (isPassable(n, ctx.map) && isSafe(n, ctx, true)) {
                return { action: "move", target: n, score: 25000 };
            }
        }
        return null;
    }
    var mainEnemyTracked = ctx.trackedEnemies && ctx.enemy ? ctx.trackedEnemies[ctx.enemy.index || 0] : null;
    return findOffAxisMoveForEnemy(ctx, mainEnemyTracked || { pos: ctx.enemyPos, dir: ctx.enemyDir });
}

function findOffAxisMoveForEnemy(ctx, hEnemy) {
    if (!hEnemy || !hEnemy.pos) return null;
    var neighbors = ["up", "right", "down", "left"], best = null, maxS = -1;
    for (var i = 0; i < neighbors.length; i++) {
        var n = addPos(ctx.myPos, delta(neighbors[i]));
        if (isPassable(n, ctx.map) && isSafe(n, ctx, true)) {
            var s = getDist(n, hEnemy.pos);
            var isNeighborOnAxis = (n[0] === hEnemy.pos[0] || n[1] === hEnemy.pos[1]);
            if (!isNeighborOnAxis) {
                s += 0.5;
            }
            if (directionTo(ctx.myPos, n) === ctx.myDir) {
                s += 0.1;
            }
            if (s > maxS) { maxS = s; best = n; }
        }
    }
    return best ? { action: "move", target: best, score: 25000 } : null;
}

// 判断草丛格是否有至少一个可步行出口（防止四面都是石头的降阱草丛）
function hasWalkableExit(pos, map) {
    if (G_Blueprint.mapVision && G_Blueprint.mapVision.trapped) {
        if (G_Blueprint.mapVision.trapped[pos[0] + "," + pos[1]]) return false;
    }
    return true;
}

function findSafeGrassSpot(ctx) {
    var grass = [];
    for (var k in G_Blueprint.mapVision.grass) {
        var p = k.split(",").map(Number);
        if (!hasWalkableExit(p, ctx.map)) continue; // 跳过四面封面的降阱草丛
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

function findNearestSafeGrass(pos, ctx) {
    var best = null, minDist = 999;
    for (var k in G_Blueprint.mapVision.grass) {
        var p = k.split(",").map(Number);
        if (!hasWalkableExit(p, ctx.map)) continue; // 跳过四面封面的降阱草丛
        if (!isSafe(p, ctx, true)) continue;
        if (ctx.enemyPos && getDist(p, ctx.enemyPos) <= 2) continue;
        var d = getDist(pos, p);
        if (d < minDist) { minDist = d; best = p; }
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
    var e = ctx.enemyPos;
    // 根据敌方朝向排序 offsets：背后 > 侧翼 > 正面（仍为 4 个候选）
    var offsets = getAssassinOffsets(ctx.enemyDir);

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

    // 2. 兜底当前点（加安全校查）
    for (var i = 0; i < offsets.length; i++) {
        var p = addPos(e, offsets[i]);
        if (isPassable(p, ctx.map) && canShoot(p, e, ctx.map) === true && isSafe(p, ctx, false)) return p;
    }
    return null;
}

// 根据敌方朝向返回 4 个 offset，背后优先
function getAssassinOffsets(enemyDir) {
    var d = enemyDir || "up";
    if (d === "up") return [[0, 5], [-5, 0], [5, 0], [0, -5]];  // 背后(下) > 左右 > 正面(上)
    if (d === "down") return [[0, -5], [-5, 0], [5, 0], [0, 5]];  // 背后(上) > 左右 > 正面(下)
    if (d === "left") return [[5, 0], [0, -5], [0, 5], [-5, 0]];  // 背后(右) > 上下 > 正面(左)
    if (d === "right") return [[-5, 0], [0, -5], [0, 5], [5, 0]];  // 背后(左) > 上下 > 正面(右)
    return [[-5, 0], [5, 0], [0, -5], [0, 5]];
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
    if (isPassable(q, ctx.map) && isSafe(q, ctx, true) && hasWalkableExit(q, ctx.map)) return q;
    return findEscapeSpot(ctx);
}

function findEscapeSpot(ctx) {
    var offs = [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 4], [-4, -4]];
    for (var i = 0; i < offs.length; i++) {
        var p = addPos(ctx.myPos, offs[i]); 
        if (isPassable(p, ctx.map) && isSafe(p, ctx, false) && hasWalkableExit(p, ctx.map)) return p;
    }
    return null;
}

function findBestDodge(ctx, hitLimit) {
    var bullets = ctx.visibleBullets;
    if (!bullets || bullets.length === 0) return null;
    var dirs = ["up", "right", "down", "left"], best = null, maxH = -1;
    for (var i = 0; i < dirs.length; i++) {
        var n = addPos(ctx.myPos, delta(dirs[i]));
        if (isPassable(n, ctx.map)) {
            var h = getMinFramesToHit(n, bullets, ctx.map); if (h > maxH && h > hitLimit) { maxH = h; best = n; }
        }
    }
    return best;
}

function getFramesToHit(pos, bullet, map) {
    if (!bullet) return Infinity;
    if (isLoS(bullet.position, pos, bullet.direction, map)) return Math.ceil(getDist(pos, bullet.position) / 2);
    return Infinity;
}

function getMinFramesToHit(pos, bullets, map) {
    var minFH = Infinity;
    if (!bullets || bullets.length === 0) return minFH;
    for (var i = 0; i < bullets.length; i++) {
        var b = bullets[i];
        var fH = getFramesToHit(pos, b, map);
        if (fH < minFH) {
            minFH = fH;
        }
    }
    return minFH;
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
function getTurnDir(currentDir, targetDir) {
    if (!targetDir || currentDir === targetDir) return null;
    var dirs = ["up", "right", "down", "left"];
    var curIdx = dirs.indexOf(currentDir);
    var tarIdx = dirs.indexOf(targetDir);
    if (curIdx === -1 || tarIdx === -1) return null;
    var diff = (tarIdx - curIdx + 4) % 4;
    if (diff === 1) return "right";
    if (diff === 3) return "left";
    return "right";
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
    return null;
}

function chooseMainTarget(me, enemy, game) {
    var candidates = [];
    if (game.enemies && game.enemies.length > 0) {
        for (var i = 0; i < game.enemies.length; i++) {
            var e = game.enemies[i];
            if (e && e.tank && e.tank.position) {
                candidates.push(e);
            }
        }
    }
    if (candidates.length === 0) {
        if (enemy && enemy.tank && enemy.tank.position) {
            candidates.push(enemy);
        }
    }
    if (candidates.length === 0) return null;

    var myPos = me.tank.position;
    var myStars = me.stars || 0;
    candidates.sort(function (a, b) {
        return getTargetScore(a, myPos, myStars) - getTargetScore(b, myPos, myStars);
    });
    return candidates[0];
}

function getTargetScore(e, myPos, myStars) {
    var pos = e.tank.position;
    var score = getDist(myPos, pos);
    if ((e.stars || 0) > myStars) score -= 3;
    if (e.bullet) score -= 5;
    if (e.status && e.status.dead) score += 999;
    return score;
}

function getVisibleBullets(enemy, game) {
    var bullets = [];
    if (game.visibleBullets && game.visibleBullets.length > 0) {
        for (var i = 0; i < game.visibleBullets.length; i++) {
            var b = game.visibleBullets[i];
            if (b && b.position) bullets.push(b);
        }
    } else {
        if (enemy && enemy.bullet) {
            bullets.push(enemy.bullet);
        }
    }
    return bullets;
}

function updateEnemiesHistory(enemy, game) {
    if (!G_History.enemies) G_History.enemies = {};

    var seenIndices = {};
    if (game.enemies && game.enemies.length > 0) {
        for (var i = 0; i < game.enemies.length; i++) {
            var e = game.enemies[i];
            if (e && e.tank && e.tank.position) {
                var idx = e.index;
                seenIndices[idx] = true;
                G_History.enemies[idx] = {
                    index: idx,
                    pos: e.tank.position,
                    dir: e.tank.direction,
                    frame: G_History.frame,
                    visible: true,
                    skillReady: e.skill && e.skill.remainingCooldownFrames === 0,
                    skillType: e.skill ? e.skill.type : "none",
                    hasOverload: e.skill && e.skill.type === "overload",
                    overloaded: e.status && e.status.overloaded
                };
            }
        }
    } else if (enemy && enemy.tank && enemy.tank.position) {
        var idx = enemy.index || 0;
        seenIndices[idx] = true;
        G_History.enemies[idx] = {
            index: idx,
            pos: enemy.tank.position,
            dir: enemy.tank.direction,
            frame: G_History.frame,
            visible: true,
            skillReady: enemy.skill && enemy.skill.remainingCooldownFrames === 0,
            skillType: enemy.skill ? enemy.skill.type : "none",
            hasOverload: enemy.skill && enemy.skill.type === "overload",
            overloaded: enemy.status && enemy.status.overloaded
        };
    }

    // Mark invisible if not seen this frame
    for (var idx in G_History.enemies) {
        if (!seenIndices[idx]) {
            G_History.enemies[idx].visible = false;
        }
    }
}

function isEnemyOverloadActiveForTracked(hEnemy, ctx) {
    if (!hEnemy.hasOverload) return false;
    var recentlyOverloaded = G_History.lastEnemyOverloadedFrame && (G_History.frame - G_History.lastEnemyOverloadedFrame < 8);
    return hEnemy.overloaded || hEnemy.skillReady || recentlyOverloaded;
}

function isOnEnemyGunLineForTracked(pos, hEnemy, ctx, checkOverload) {
    if (!hEnemy.pos || !hEnemy.dir) return false;
    if (isLoS(hEnemy.pos, pos, hEnemy.dir, ctx.map)) return true;
    if (checkOverload && isEnemyOverloadActiveForTracked(hEnemy, ctx)) {
        var rightDir = { up: "right", right: "down", down: "left", left: "up" }[hEnemy.dir];
        var leftDir = { up: "left", right: "up", down: "right", left: "down" }[hEnemy.dir];
        var rightOrigin = addPos(hEnemy.pos, delta(rightDir));
        var leftOrigin = addPos(hEnemy.pos, delta(leftDir));
        if (isLoS(rightOrigin, pos, hEnemy.dir, ctx.map)) return true;
        if (isLoS(leftOrigin, pos, hEnemy.dir, ctx.map)) return true;
    }
    return false;
}