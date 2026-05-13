var xdbPostTeleportFrames = 0;
var xdbLastEnemyTank = null;
var xdbLastEnemySeenFrame = -999;

/**
 * AgenTank AI Agent - V21 (战术进化版)
 * 核心优化：
 * 1. 护盾博弈 (Shield Baiting)：检测到敌方护盾时停止射击并侧向机动。
 * 2. 精准传送 (Precision Teleport)：优先传送到曼哈顿距离为5的位置，避开火控锁定同时保持压制。
 * 3. 动作经济优化：在决策中增加对转向成本的考量。
 */

var XDB_CONFIG = {
    PRECISION_TELEPORT_DIST: 5,     // 理想传送距离（避开4格火控锁定）
    SHIELD_BAIT_RADIUS: 6,          // 触发护盾博弈的半径
    TURN_COST_WEIGHT: 1.2           // 转向权重（用于动作经济优化）
};

function onIdle(me, enemy, game) {
  if (xdbPostTeleportFrames > 0) xdbPostTeleportFrames--;

  var myPos = me.tank.position;
  var myDir = me.tank.direction;
  rememberEnemyTank(enemy ? enemy.tank : null, game);
  var enemyBullet = enemy ? enemy.bullet : null;
  var map = game.map;
  var isSkillReady = me.skill && me.skill.remainingCooldownFrames === 0;
  var hasStarLead = hasMoreStars(me, enemy);
  var enemyThreat = buildEnemyThreat(enemy, game);
  var enemyTank = enemyThreat ? enemyThreat.tank : null;
  var enemyVisible = !!(enemy && enemy.tank);
  var shouldPreferStarTeleport = !!game.star && !hasStarLead && !shouldReserveTeleportForCombat(me, enemyThreat);

  // --- 技能手册 (Skills Handbook) ---
  // Freeze: 持续4帧, 冷却40帧
  // Stun: 持续2帧, 冷却34帧
  // Teleport: 传送后会有2帧火控锁定(fire-locked)

  // --- 0. 状态自检 ---
  if (me.status && (me.status.stunned || me.status.frozen)) {
      return; // 被控制时无法行动
  }

  // --- 0.1 全局生存校验 (V20: 强制传送防御) ---
  if (enemyTank && enemyThreat) {
      var distToEnemy = getDistance(myPos, enemyTank.position);
      var enemyHasControlReady = enemyThreat.control; // 技能画像统一预警

      // 零距离反射逻辑：在极近距离（3格内）感知威胁时，强制瞬移
      if (distToEnemy <= enemyThreat.closeRange) {
          var enemyIsFacingUs = isEnemyThreatLine(myPos, enemyThreat, map);
          if (enemyIsFacingUs || enemyBullet) {
              if (isSkillReady) {
                  var closeDodge = getDodgeFromLineOfFire(myPos, myDir, directionTo(enemyTank.position, myPos), map, enemyThreat, enemyBullet);
                  if (hasImmediateTeleportThreat(myPos, myDir, enemyThreat, enemyBullet, map, closeDodge)) {
                      if (tryTeleportEscapes(me, game.star, enemyThreat, enemyBullet, map, myDir, shouldPreferStarTeleport, true)) return;
                  }
              }
          }
      }

      // 动态安全半径逻辑：如果敌人控制技能准备就绪，10格内均为危险区
      var safetyThreshold = Math.max(enemyHasControlReady ? enemyThreat.controlRadius : 5, enemyThreat.closeRange + 1);
      if (distToEnemy <= safetyThreshold) {
          var inPotentalLoF = false;
          var dirs = ["up", "right", "down", "left"];
          for (var i=0; i<dirs.length; i++) {
              if (isThreatLineFrom(myPos, enemyTank.position, dirs[i], enemyThreat, map)) {
                  inPotentalLoF = true;
                  break;
              }
          }

          if (inPotentalLoF) {
              // 潜在枪线优先普通横移，只有真实迫近威胁才消耗传送。
              var escapeMove = getDodgeFromLineOfFire(myPos, myDir, directionTo(enemyTank.position, myPos), map, enemyThreat, enemyBullet);
              if (escapeMove) {
                  moveToward(me, myDir, myPos, escapeMove);
                  return;
              }
              if (isSkillReady && hasImmediateTeleportThreat(myPos, myDir, enemyThreat, enemyBullet, map, escapeMove)) {
                  if (tryTeleportEscapes(me, game.star, enemyThreat, enemyBullet, map, myDir, shouldPreferStarTeleport, true)) return;
              }
          }
      }
  }

  // --- 0.5 抢星逻辑 (星数未领先时才主动用传送抢星) ---
  if (isSkillReady && game.star && shouldPreferStarTeleport) {
      // 只有落点通过10格动态安全校验且不在敌人枪线上，才允许抢星
      if (isLocationSafe(game.star, enemyThreat, map)) {
          if (isPassable(game.star, map) && getFramesToThreat(game.star, enemyBullet, enemyThreat, map) === Infinity) {
              performTeleport(me, game.star);
              return;
          }
      }
  }

  // --- 0.6 传送后脱离模式：落地后先离开敌方预测枪线，不急着继续追星 ---
  if (xdbPostTeleportFrames > 0 && enemyTank) {
      var disengageMove = getDisengagePosition(myPos, myDir, enemyTank, map, enemyBullet, enemyThreat);
      if (disengageMove) {
          moveToward(me, myDir, myPos, disengageMove);
          return;
      }
  }

  // --- 0.7 针对危险技能的横向断轴：boost/overload/control 近身时不沿直线硬追 ---
  if (enemyTank && getDistance(myPos, enemyTank.position) <= enemyThreat.closeRange && isHighPressureSkill(enemyThreat)) {
      var breakAxisMove = getBreakAxisMove(myPos, myDir, enemyTank, map, enemyBullet, enemyThreat);
      if (breakAxisMove) {
          moveToward(me, myDir, myPos, breakAxisMove);
          return;
      }
  }

  // --- 1. 子弹闪避逻辑 ---
  var framesToHit = getFramesToThreat(myPos, enemyBullet, enemyThreat, map);
  if (framesToHit !== Infinity) {
    var dodgeInfo = getDodgeInfo(myPos, myDir, enemyBullet, enemyThreat, map, framesToHit);
    if (isSkillReady) {
       // 如果常规躲避来不及，或者躲避点不安全，强制传送
       if (!dodgeInfo && hasImmediateTeleportThreat(myPos, myDir, enemyThreat, enemyBullet, map, dodgeInfo)) {
           if (tryTeleportEscapes(me, game.star, enemyThreat, enemyBullet, map, myDir, shouldPreferStarTeleport, true)) return;
       }
    }
    if (dodgeInfo && dodgeInfo.move) {
      moveToward(me, myDir, myPos, dodgeInfo.move);
      return;
    }
    return;
  }

  // --- 2. 战术进攻逻辑 ---
  if (enemyTank) {
      var distToEnemy = getDistance(myPos, enemyTank.position);
      var enemyIsFacing = isEnemyThreatLine(myPos, enemyThreat, map);
      var canWeShoot = enemyVisible && canShoot(myPos, enemyTank.position, map);
      var targetDir = directionTo(myPos, enemyTank.position);
      var iAmFacing = (myDir === targetDir);

      if (tryPredictiveFire(me, myPos, myDir, enemyTank, enemyThreat, enemyBullet, map, game.star, hasStarLead, shouldPreferStarTeleport)) {
          return;
      }
      
      if (enemyIsFacing) {
          var amIStarAdvantaged = (me.stars !== undefined && enemy.stars !== undefined) ? (me.stars >= enemy.stars) : false;
          var isHeadToHead = iAmFacing && canWeShoot;
          
          // 如果处于劣势且距离过近，强制寻求闪避或传送
          if (!iAmFacing || (me.status && me.status.fireLocked) || distToEnemy <= 2 || (isHeadToHead && !amIStarAdvantaged)) {
              var qdDodge = getDodgeFromLineOfFire(myPos, myDir, targetDir, map, enemyThreat, enemyBullet);
              if (qdDodge) {
                  moveToward(me, myDir, myPos, qdDodge);
                  return;
              }
              if (isSkillReady && hasImmediateTeleportThreat(myPos, myDir, enemyThreat, enemyBullet, map, qdDodge)) {
                  if (tryTeleportEscapes(me, game.star, enemyThreat, enemyBullet, map, myDir, shouldPreferStarTeleport, true)) return;
              }
          }
      }
      
      // 战术策略：未领先时星星优先；领先且传送可用时，优先保留进攻/保命节奏。
      var shouldSkipDuelForStar = false;
      if (game.star) {
          var myDistToStar = getDistance(myPos, game.star);
          var enemyDistToStar = getDistance(enemyTank.position, game.star);
          if (myDistToStar <= enemyDistToStar || (isSkillReady && shouldPreferStarTeleport)) {
              shouldSkipDuelForStar = true;
          }
      }

      if (!shouldSkipDuelForStar) {
          // --- 核心优化 1: 护盾博弈 (Shield Baiting) ---
          if (enemyThreat && enemyThreat.shielded) {
              // 敌人开盾时，停止射击，并优先进行侧向位移，引诱敌人浪费子弹
              var baitMove = getDodgeFromLineOfFire(myPos, myDir, targetDir, map, enemyThreat, enemyBullet);
              if (baitMove) {
                  moveToward(me, myDir, myPos, baitMove);
                  return;
              }
          }

          if (canWeShoot && iAmFacing && !(me.status && me.status.fireLocked) && !(enemyThreat && enemyThreat.shielded)) {
              me.fire();
              return;
          }
          if (canWeShoot && !iAmFacing && !(enemyThreat && enemyThreat.shielded)) {
              me.turn(targetDir);
              return;
          }
      }
  }

  // --- 3. 目标点设定 ---
  var target = null;
  var allowLoF = false;

  if (game.star) {
      // 寻星逻辑
      if (!enemyTank) {
          target = game.star;
      } else {
          var myDistToStar = getDistance(myPos, game.star);
          var blockPos = getStarBlockPosition(myPos, enemyTank, game.star, map, enemyBullet, enemyThreat);
          if (blockPos && (hasStarLead || getDistance(enemyTank.position, game.star) < myDistToStar)) {
              target = blockPos;
              allowLoF = false;
          } else if (isLocationSafe(game.star, enemyThreat, map)) {
              // 只有确认寻路终点安全时，才将星星设为目标
              target = game.star;
              allowLoF = true;
          } else {
              // 如果星星不安全，寻找附近的伏击位
              var ambushSpot = findAmbushSpot(game.star, map);
              if (ambushSpot) target = ambushSpot;
          }
      }
  }

  // --- 4. 智能位移执行 ---
  if (!target && enemyTank) {
      var distToEnemy = getDistance(myPos, enemyTank.position);
      var enemyIsFacingUs = isEnemyThreatLine(myPos, enemyThreat, map);
      
      // 猎杀逻辑：只有在安全的情况下才主动接近
      if (isSkillReady || distToEnemy > 6) {
          target = enemyTank.position;
          allowLoF = true;
      } else {
          // 没技能时，保持距离
          var fleePos = getFleePosition(myPos, enemyTank, map, enemyBullet, enemyThreat);
          if (fleePos) {
              moveToward(me, myDir, myPos, fleePos);
              return;
          }
      }
  }

  if (target) {
      var next = bfs(myPos, target, map, enemyBullet, enemyThreat, true); 
      if (!next && allowLoF) {
          next = bfs(myPos, target, map, enemyBullet, enemyThreat, false); 
      }
      
      if (next) {
          moveToward(me, myDir, myPos, next);
          return;
      }
  }

  // --- 5. 巡逻兜底 (稳健型) ---
  var pMove = safePatrol(myPos, myDir, map, enemyThreat);
  if (pMove) {
      moveToward(me, myDir, myPos, pMove);
      return;
  }
}

// --- V20 核心逻辑库 ---

/**
 * 判断落点是否安全
 * 1. 禁止在敌人控制技能范围(10格)内。
 * 2. 禁止在敌人的十字射击轴线上（LoF）。
 * 3. 禁止直接贴脸（距离<=1）。
 */
function rememberEnemyTank(enemyTank, game) {
    if (!enemyTank) return;
    xdbLastEnemyTank = {
        position: [enemyTank.position[0], enemyTank.position[1]],
        direction: enemyTank.direction,
        id: enemyTank.id
    };
    xdbLastEnemySeenFrame = getGameFrame(game);
}

function getGameFrame(game) {
    if (!game) return 0;
    if (game.frame !== undefined) return game.frame;
    if (game.frames !== undefined) return game.frames;
    if (game.tick !== undefined) return game.tick;
    if (game.turn !== undefined) return game.turn;
    return 0;
}

function isStatusActive(status, effects, name) {
    if (status && status[name]) return true;
    if (effects && effects[name]) return true;
    if (effects && effects.length !== undefined) {
        for (var i = 0; i < effects.length; i++) {
            var e = effects[i];
            if (e === name) return true;
            if (e && (e.type === name || e.name === name || e.skillType === name)) return true;
        }
    }
    return false;
}

function isSkillActive(status, effects, skillType) {
    if (!skillType) return false;
    if (isStatusActive(status, effects, skillType)) return true;
    if (isStatusActive(status, effects, skillType + "ed")) return true;
    if (skillType === "freeze" && isStatusActive(status, effects, "frozen")) return true;
    if (skillType === "stun" && isStatusActive(status, effects, "stunned")) return true;
    if (skillType === "shield" && isStatusActive(status, effects, "shielded")) return true;
    if (skillType === "overload" && isStatusActive(status, effects, "overloaded")) return true;
    if (skillType === "boost" && isStatusActive(status, effects, "boosted")) return true;
    if (skillType === "cloak" && isStatusActive(status, effects, "cloaked")) return true;
    if (skillType === "poison" && isStatusActive(status, effects, "poisoned")) return true;
    return false;
}

function isControlSkill(skillType) {
    return skillType === "stun" || skillType === "freeze" || skillType === "poison";
}

function isCombatSkill(skillType) {
    return skillType === "overload" || skillType === "stun" || skillType === "freeze" ||
        skillType === "poison" || skillType === "boost" || skillType === "teleport";
}

function isLocationSafe(pos, enemy, map) {
    var enemyInfo = enemy && enemy.skillType !== undefined ? enemy : buildEnemyThreat(enemy, null);
    if (!enemyInfo || !enemyInfo.tank) return true;
    var eTank = enemyInfo.tank;
    var distToEnemy = getDistance(pos, eTank.position);

    if (distToEnemy <= enemyInfo.minSafeDistance) return false;
    if (enemyInfo.control && distToEnemy <= enemyInfo.controlRadius && isPredictedEnemyThreatLine(pos, enemyInfo, map)) return false;
    if (enemyInfo.teleportReady && distToEnemy <= 4) return false;
    if (enemyInfo.cloaked && distToEnemy <= 6) return false;

    if (isDangerousPosition(pos, enemyInfo, null, map)) return false;
    
    return true;
}

function hasMoreStars(me, enemy) {
    return me && enemy && me.stars !== undefined && enemy.stars !== undefined && me.stars > enemy.stars;
}

function shouldReserveTeleportForCombat(me, enemyThreat) {
    if (!enemyThreat || !enemyThreat.tank || !enemyThreat.skillType) return false;
    if (!enemyThreat.reserveTeleport) return false;
    return getDistance(me.tank.position, enemyThreat.tank.position) <= enemyThreat.reserveRadius;
}

function buildEnemyThreat(enemy, game) {
    if (enemy && enemy.closeRange !== undefined && enemy.minSafeDistance !== undefined && enemy.predictSteps !== undefined) return enemy;
    if (!enemy && !xdbLastEnemyTank) return null;
    var visibleTank = enemy && enemy.tank ? enemy.tank : null;
    var rememberedTank = !visibleTank && xdbLastEnemyTank ? xdbLastEnemyTank : null;
    if (!visibleTank && !rememberedTank) return null;
    var frameNow = game ? getGameFrame(game) : xdbLastEnemySeenFrame;
    var invisibleFrames = visibleTank ? 0 : Math.max(0, frameNow - xdbLastEnemySeenFrame);
    if (!visibleTank && invisibleFrames > 12) return null;
    var tank = visibleTank || rememberedTank;
    var skillType = enemy && enemy.skill ? enemy.skill.type : null;
    var cd = enemy && enemy.skill ? enemy.skill.remainingCooldownFrames : Infinity;
    var status = enemy && enemy.status ? enemy.status : {};
    var effects = enemy && enemy.effects ? enemy.effects : null;
    var isReadyNow = cd === 0;
    var isReadySoon = cd <= 2;
    var activeBoost = isSkillActive(status, effects, "boost");
    var activeOverload = isSkillActive(status, effects, "overload");
    var activeShield = isSkillActive(status, effects, "shield");
    var activeCloak = isSkillActive(status, effects, "cloak") || (!visibleTank && skillType === "cloak");
    var activeControl = isSkillActive(status, effects, "stun") || isSkillActive(status, effects, "freeze") || isSkillActive(status, effects, "poison");
    var hasControl = isControlSkill(skillType) && (isReadySoon || activeControl);
    var hasBoost = skillType === "boost" && (cd <= 8 || activeBoost);
    var hasOverload = skillType === "overload" && (cd <= 8 || activeOverload);
    var teleportReady = skillType === "teleport" && cd === 0;
    var closeRange = 3;
    if (hasBoost) closeRange = 7;
    else if (hasControl || hasOverload || teleportReady) closeRange = 5;

    var predictSteps = hasBoost ? 3 : 1;
    if (activeCloak) predictSteps = Math.max(predictSteps, Math.min(4, 1 + invisibleFrames));
    if (teleportReady) predictSteps = Math.max(predictSteps, 2);

    return {
        tank: tank,
        visible: !!visibleTank,
        lastSeenFrame: xdbLastEnemySeenFrame,
        invisibleFrames: invisibleFrames,
        skill: enemy && enemy.skill ? enemy.skill : null,
        skillType: skillType,
        cooldown: cd,
        ready: isReadyNow,
        readySoon: isReadySoon,
        control: hasControl,
        boost: hasBoost,
        overload: hasOverload,
        shielded: activeShield,
        cloaked: activeCloak,
        teleportReady: teleportReady,
        fireLocked: isStatusActive(status, effects, "fireLocked") || isStatusActive(status, effects, "fire-locked") || isStatusActive(status, effects, "fire_locked"),
        poisoned: isSkillActive(status, effects, "poison"),
        closeRange: closeRange,
        minSafeDistance: hasBoost ? 4 : (hasControl || hasOverload || activeCloak ? 3 : 2),
        controlRadius: skillType === "stun" ? 9 : (skillType === "freeze" ? 8 : (skillType === "poison" ? 7 : 5)),
        reserveTeleport: isCombatSkill(skillType) && (cd <= 10 || activeBoost || activeOverload || hasControl || teleportReady || activeCloak),
        reserveRadius: (hasBoost || teleportReady || activeCloak) ? 14 : 12,
        predictSteps: predictSteps,
        preferPredictiveFire: hasBoost || activeCloak || teleportReady,
        avoidTurningDuel: hasControl || hasOverload || activeCloak,
        canPunishFireLock: skillType === "teleport" && (isStatusActive(status, effects, "fireLocked") || isStatusActive(status, effects, "fire-locked") || isStatusActive(status, effects, "fire_locked"))
    };
}

/**
 * 统一传送管理 (增加枪线避让)
 */
function hasImmediateTeleportThreat(myPos, myDir, enemyThreat, enemyBullet, map, safeMove) {
    var realBulletFrames = getFramesToHit(myPos, enemyBullet, map);
    if (realBulletFrames !== Infinity) {
        if (!safeMove) return true;
        var movePos = safeMove.move ? safeMove.move : safeMove;
        var moveDir = directionTo(myPos, movePos);
        var framesNeeded = (myDir === moveDir) ? 1 : 2;
        if (enemyThreat && (enemyThreat.control || enemyThreat.poisoned) && myDir !== moveDir) framesNeeded++;
        return framesNeeded >= realBulletFrames;
    }

    if (!enemyThreat || !enemyThreat.tank || enemyThreat.visible === false) return false;
    var dist = getDistance(myPos, enemyThreat.tank.position);
    var currentLine = isEnemyThreatLine(myPos, enemyThreat, map);
    if (currentLine) {
        if (dist <= 2) return true;
        if (!safeMove && dist <= enemyThreat.closeRange) return true;
        if (!safeMove && isHighPressureSkill(enemyThreat) && dist <= enemyThreat.closeRange + 1) return true;
    }

    if (!safeMove && isHighPressureSkill(enemyThreat) && dist <= enemyThreat.minSafeDistance) return true;
    return false;
}

function tryTeleportEscapes(me, starPos, enemy, enemyBullet, map, myDir, preferStarTeleport, allowTacticalEscape) {
    var enemyInfo = buildEnemyThreat(enemy);
    var enemyTank = enemyInfo ? enemyInfo.tank : null;
    allowTacticalEscape = !!allowTacticalEscape;

    if (preferStarTeleport && teleportToStarIfSafe(me, starPos, enemyInfo, enemyBullet, map)) return true;

    if (allowTacticalEscape) {
        // 1. 战术绕后 (严禁跳入轴线)
        var killSpot = findAssassinationSpot(enemyTank, map, myDir);
        if (killSpot && isLocationSafe(killSpot, enemyInfo, map)) {
            if (getFramesToThreat(killSpot, enemyBullet, enemyInfo, map) === Infinity) {
                performTeleport(me, killSpot);
                return true;
            }
        }

        // 2. 广域安全搜索。只允许真实迫近威胁进入，避免无星无危险乱传送。
        var safeSpot = findGlobalSafeSpot(me.tank.position, enemyInfo, map, enemyBullet);
        if (safeSpot) {
            performTeleport(me, safeSpot);
            return true;
        }
    }

    // 3. 星数领先时，星星只作为保命兜底落点，不再优先消耗传送抢星。
    if (allowTacticalEscape && !preferStarTeleport && teleportToStarIfSafe(me, starPos, enemyInfo, enemyBullet, map)) return true;
    return false;
}

function teleportToStarIfSafe(me, starPos, enemyInfo, enemyBullet, map) {
    if (starPos && isLocationSafe(starPos, enemyInfo, map)) {
        if (enemyInfo && enemyInfo.tank && getDistance(starPos, enemyInfo.tank.position) <= 4) return false;
        if (!hasSafeExit(starPos, enemyInfo, enemyBullet, map)) return false;
        if (isPassable(starPos, map) && getFramesToThreat(starPos, enemyBullet, enemyInfo, map) === Infinity) {
            performTeleport(me, starPos);
            return true;
        }
    }
    return false;
}

function performTeleport(me, pos) {
    me.teleport(pos[0], pos[1]);
    xdbPostTeleportFrames = 5;
}

/**
 * 寻找全局安全点 (V20: 强制避开所有敌对轴线)
 */
function findGlobalSafeSpot(myPos, enemyInfo, map, bullet) {
    var offsets = [
        [2,2], [-2,-2], [2,-2], [-2,2], 
        [3,3], [-3,-3], [3,0], [0,3], [-3,0], [0,-3],
        [4,2], [2,4], [-4,-2], [-2,-4], [4,-2], [-2,4], [-4,2], [2,-4],
        [5,0], [0,5], [-5,0], [0,-5], [3,2], [2,3], [-3,2], [2,-3]
    ];
    var best = null;
    var bestScore = -9999;
    for (var i = 0; i < offsets.length; i++) {
        var p = add(myPos, offsets[i]);
        if (isPassable(p, map) && isLocationSafe(p, enemyInfo, map)) {
            if (getFramesToThreat(p, bullet, enemyInfo, map) === Infinity) {
                var score = 0;
                var dist = enemyInfo && enemyInfo.tank ? getDistance(p, enemyInfo.tank.position) : 0;
                
                // --- 核心优化 2: 精准传送 (Precision Teleport) ---
                // 优先选择曼哈顿距离为 XDB_CONFIG.PRECISION_TELEPORT_DIST (5) 的位置
                // 这样可以避开 4 格内的火控锁定，落地瞬间即可开火
                if (dist === XDB_CONFIG.PRECISION_TELEPORT_DIST) score += 15;
                else if (dist > 5) score += (10 - dist); // 保持在射程内但不要太远
                
                if (enemyInfo && enemyInfo.overload && enemyInfo.tank && p[0] !== enemyInfo.tank.position[0] && p[1] !== enemyInfo.tank.position[1]) score += 8;
                if (enemyInfo && enemyInfo.boost && enemyInfo.tank && isPerpendicular(directionTo(myPos, p), enemyInfo.tank.direction)) score += 6;
                if (score > bestScore) {
                    bestScore = score;
                    best = p;
                }
            }
        }
    }
    return best;
}

function hasSafeExit(pos, enemyThreat, bullet, map) {
    var dirs = ["up", "right", "down", "left"];
    for (var i = 0; i < dirs.length; i++) {
        var next = add(pos, delta(dirs[i]));
        if (isPassable(next, map) && !isDangerousPosition(next, enemyThreat, bullet, map)) return true;
    }
    return false;
}

function isHighPressureSkill(enemyThreat) {
    return enemyThreat && (enemyThreat.boost || enemyThreat.overload || enemyThreat.control || enemyThreat.cloaked || enemyThreat.teleportReady);
}

function getBreakAxisMove(myPos, myDir, enemyTank, map, bullet, enemyThreat) {
    var awayDir = directionTo(enemyTank.position, myPos);
    var dirs = [getRightDir(awayDir), getLeftDir(awayDir), awayDir, getOppositeDir(awayDir)];
    var best = null;
    var bestScore = -9999;
    for (var i = 0; i < dirs.length; i++) {
        var d = dirs[i];
        var next = add(myPos, delta(d));
        if (!isPassable(next, map) || isDangerousPosition(next, enemyThreat, bullet, map)) continue;

        var score = getDistance(next, enemyTank.position) * 5;
        if (next[0] !== enemyTank.position[0] && next[1] !== enemyTank.position[1]) score += 12;
        if (myDir === d) score += 3;
        if (isPerpendicular(d, directionTo(enemyTank.position, myPos))) score += 4;
        if (enemyThreat && enemyThreat.boost && isPerpendicular(d, enemyTank.direction)) score += 8;
        if (enemyThreat && enemyThreat.overload && next[0] !== enemyTank.position[0] && next[1] !== enemyTank.position[1]) score += 8;
        if (enemyThreat && enemyThreat.teleportReady && getDistance(next, enemyTank.position) >= 5) score += 5;

        if (score > bestScore) {
            bestScore = score;
            best = next;
        }
    }
    return best;
}

function getStarBlockPosition(myPos, enemyTank, starPos, map, bullet, enemyThreat) {
    if (!starPos || !enemyTank) return null;
    var step = nextStepToward(enemyTank.position, starPos, map);
    if (!step) return null;
    if (!isPassable(step, map) || isDangerousPosition(step, enemyThreat, bullet, map)) return null;

    var myDist = getDistance(myPos, step);
    var enemyDist = getDistance(enemyTank.position, step);
    var reachBonus = enemyThreat && enemyThreat.boost ? 2 : 0;
    if (myDist > enemyDist + 2 + reachBonus) return null;
    return step;
}

function tryPredictiveFire(me, myPos, myDir, enemyTank, enemyThreat, enemyBullet, map, starPos, hasStarLead, shouldPreferStarTeleport) {
    if (!enemyTank || (me.status && me.status.fireLocked)) return false;
    if (enemyThreat && enemyThreat.shielded) return false;
    if (isDangerousPosition(myPos, enemyThreat, enemyBullet, map)) return false;
    if (!hasStarLead && shouldPreferStarTeleport && starPos && !(enemyThreat && enemyThreat.preferPredictiveFire)) return false;
    if (getDistance(myPos, enemyTank.position) <= 3 && !hasStarLead && !(enemyThreat && enemyThreat.canPunishFireLock)) return false;

    var shot = findPredictiveShot(myPos, enemyTank, enemyThreat, map, starPos, hasStarLead);
    if (!shot) return false;

    var shotDir = directionTo(myPos, shot.pos);
    if (myDir === shotDir) {
        me.fire();
        return true;
    }

    if ((hasStarLead || (enemyThreat && enemyThreat.preferPredictiveFire)) && shot.confidence >= 3 && getDistance(myPos, enemyTank.position) > 5) {
        me.turn(shotDir);
        return true;
    }
    return false;
}

function findPredictiveShot(myPos, enemyTank, enemyThreat, map, starPos, hasStarLead) {
    var candidates = [];
    var p = enemyTank.position;
    var maxForward = enemyThreat && enemyThreat.boost ? 6 : 4;
    for (var i = 1; i <= maxForward; i++) {
        p = add(p, delta(enemyTank.direction));
        if (!isPassable(p, map)) break;
        var enemyFrames = enemyThreat && enemyThreat.boost ? Math.ceil(i / 2) : i;
        candidates.push({ pos: p, enemyFrames: enemyFrames, confidence: 2 + (hasStarLead ? 1 : 0) + ((enemyThreat && enemyThreat.boost) ? 1 : 0) });
    }

    if (starPos) {
        var starStep = nextStepToward(enemyTank.position, starPos, map);
        if (starStep) candidates.push({ pos: starStep, enemyFrames: 1, confidence: 3 });
        if (enemyThreat && enemyThreat.boost) {
            var boostStep = starStep ? nextStepToward(starStep, starPos, map) : null;
            if (boostStep) candidates.push({ pos: boostStep, enemyFrames: 1, confidence: 4 });
        }
    }

    if (enemyThreat && enemyThreat.canPunishFireLock) {
        candidates.push({ pos: enemyTank.position, enemyFrames: 1, confidence: 5 });
    }

    var best = null;
    var bestScore = -9999;
    for (var j = 0; j < candidates.length; j++) {
        var c = candidates[j];
        if (!canShoot(myPos, c.pos, map)) continue;
        var bulletDist = getDistance(myPos, c.pos);
        if (bulletDist <= 1) continue;
        var bulletFrames = Math.ceil(bulletDist / 2);
        if (bulletFrames > c.enemyFrames + 1) continue;

        var score = c.confidence * 10 - Math.abs(bulletFrames - c.enemyFrames) - bulletDist;
        if (score > bestScore) {
            bestScore = score;
            best = c;
        }
    }
    return best;
}

function nextStepToward(start, goal, map) {
    var dirs = ["up", "right", "down", "left"];
    var best = null;
    var bestDist = getDistance(start, goal);
    for (var i = 0; i < dirs.length; i++) {
        var next = add(start, delta(dirs[i]));
        if (!isPassable(next, map)) continue;
        var dist = getDistance(next, goal);
        if (dist < bestDist) {
            bestDist = dist;
            best = next;
        }
    }
    return best;
}

function getDisengagePosition(myPos, myDir, enemyTank, map, bullet, enemyThreat) {
    var dirs = ["up", "right", "down", "left"];
    var best = null;
    var bestScore = -9999;
    for (var i = 0; i < dirs.length; i++) {
        var d = dirs[i];
        var next = add(myPos, delta(d));
        if (!isPassable(next, map) || isDangerousPosition(next, enemyThreat, bullet, map)) continue;

        var framesNeeded = (myDir === d) ? 1 : 2;
        var score = getDistance(next, enemyTank.position) * 4 - framesNeeded;
        if (next[0] !== enemyTank.position[0] && next[1] !== enemyTank.position[1]) score += 6;
        if (isPerpendicular(d, directionTo(enemyTank.position, myPos))) score += 3;

        if (score > bestScore) {
            bestScore = score;
            best = next;
        }
    }
    return best;
}

function findAssassinationSpot(enemyTank, map, myDir) {
    if (!enemyTank) return null;
    var opposite = getOppositeDir(myDir);
    var deltaPos = delta(opposite);
    var p1 = add(enemyTank.position, deltaPos);
    var p2 = add(p1, deltaPos);
    // 侧翼包抄优先
    var sides = [getRightDir(enemyTank.direction), getLeftDir(enemyTank.direction)];
    for (var i=0; i<sides.length; i++) {
        var sp1 = add(enemyTank.position, delta(sides[i]));
        if (isPassable(sp1, map)) return sp1;
    }
    if (isPassable(p1, map)) return p1;
    return null;
}

function getOppositeDir(dir) {
    if (dir === "up") return "down";
    if (dir === "down") return "up";
    if (dir === "left") return "right";
    return "left";
}

function findAmbushSpot(starPos, map) {
    var dirs = ["up", "right", "down", "left"];
    for (var i = 0; i < dirs.length; i++) {
        var d = delta(dirs[i]);
        var p = add(starPos, d);
        if (isTransparent(p, map)) {
            var p2 = add(p, d);
            if (isPassable(p2, map)) return p2;
        }
    }
    return null;
}

function isTileInLineOfFire(targetPos, shooterPos, shooterDir, map) {
    return isLineThreat(targetPos, shooterPos, shooterDir, map);
}

function isEnemyThreatLine(pos, enemyThreat, map) {
    if (!enemyThreat || !enemyThreat.tank) return false;
    return isThreatLineFrom(pos, enemyThreat.tank.position, enemyThreat.tank.direction, enemyThreat, map);
}

function isPredictedEnemyThreatLine(pos, enemyThreat, map) {
    if (!enemyThreat || !enemyThreat.tank) return false;
    var eTank = enemyThreat.tank;
    var dirs = [eTank.direction, getRightDir(eTank.direction), getLeftDir(eTank.direction)];
    if (getDistance(pos, eTank.position) <= 5 || enemyThreat.cloaked || enemyThreat.teleportReady) dirs.push(getOppositeDir(eTank.direction));
    for (var i = 0; i < dirs.length; i++) {
        if (isThreatLineFrom(pos, eTank.position, dirs[i], enemyThreat, map)) return true;
    }

    var forward = eTank.position;
    for (var stepCount = 1; stepCount <= enemyThreat.predictSteps; stepCount++) {
        forward = add(forward, delta(eTank.direction));
        if (!isPassable(forward, map)) break;
        for (var j = 0; j < dirs.length; j++) {
            if (isThreatLineFrom(pos, forward, dirs[j], enemyThreat, map)) return true;
        }
    }

    if (enemyThreat.cloaked) {
        for (var d = 0; d < dirs.length; d++) {
            var scout = eTank.position;
            for (var s = 1; s <= enemyThreat.predictSteps; s++) {
                scout = add(scout, delta(dirs[d]));
                if (!isPassable(scout, map)) break;
                for (var k = 0; k < dirs.length; k++) {
                    if (isThreatLineFrom(pos, scout, dirs[k], enemyThreat, map)) return true;
                }
            }
        }
    }
    return false;
}

function isDangerousPosition(pos, enemyThreat, bullet, map) {
    if (getFramesToHit(pos, bullet, map) !== Infinity) return true;
    if (isEnemyThreatLine(pos, enemyThreat, map)) return true;
    if (isPredictedEnemyThreatLine(pos, enemyThreat, map)) return true;
    if (enemyThreat && enemyThreat.tank && getDistance(pos, enemyThreat.tank.position) <= enemyThreat.minSafeDistance) return true;
    return false;
}

function isThreatLineFrom(pos, shooterPos, shooterDir, enemyThreat, map) {
    if (isLineThreat(pos, shooterPos, shooterDir, map)) return true;
    if (enemyThreat && enemyThreat.overload) {
        var sideA = add(shooterPos, delta(getRightDir(shooterDir)));
        var sideB = add(shooterPos, delta(getLeftDir(shooterDir)));
        if (isLineThreat(pos, sideA, shooterDir, map)) return true;
        if (isLineThreat(pos, sideB, shooterDir, map)) return true;
    }
    return false;
}

function isLineThreat(targetPos, shooterPos, shooterDir, map) {
    if (!shooterPos || (shooterPos[0] !== targetPos[0] && shooterPos[1] !== targetPos[1])) return false;
    var dir = directionTo(shooterPos, targetPos);
    if (dir !== shooterDir) return false;
    var step = delta(dir);
    var p = add(shooterPos, step);
    while (isTransparent(p, map)) {
        if (samePos(p, targetPos)) return true;
        p = add(p, step);
    }
    return false;
}

function safePatrol(myPos, myDir, map, enemyThreat) {
    var dirs = [myDir, getRightDir(myDir), getLeftDir(myDir), getOppositeDir(myDir)];
    for(var i=0; i<dirs.length; i++) {
        var next = add(myPos, delta(dirs[i]));
        if (isPassable(next, map) && !isDangerousPosition(next, enemyThreat, null, map)) return next;
    }
    return null;
}

function getRightDir(dir) {
    if (dir === "up") return "right";
    if (dir === "right") return "down";
    if (dir === "down") return "left";
    return "up";
}

function getLeftDir(dir) {
    if (dir === "up") return "left";
    if (dir === "left") return "down";
    if (dir === "down") return "right";
    return "up";
}

function getDistance(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function getFleePosition(myPos, enemyTank, map, bullet, enemyThreat) {
    var dirs = ["up", "right", "down", "left"];
    var best = null;
    var maxDist = -1;
    for(var i=0; i<dirs.length; i++) {
        var next = add(myPos, delta(dirs[i]));
        if (isPassable(next, map) && !isDangerousPosition(next, enemyThreat, bullet, map)) {
            var dist = getDistance(next, enemyTank.position);
            if (dist > maxDist) {
                maxDist = dist;
                best = next;
            }
        }
    }
    return best;
}

function getFramesToHit(pos, bullet, map) {
  if (!bullet) return Infinity;
  var bPos = bullet.position;
  var bDir = bullet.direction;
  var step = delta(bDir);
  var p = bPos;
  var dist = 0;
  while (isTransparent(p, map)) {
    if (samePos(p, pos)) return Math.ceil(dist / 2);
    p = add(p, step);
    dist++;
  }
  return Infinity;
}

function getFramesToThreat(pos, bullet, enemyThreat, map) {
  var frames = getFramesToHit(pos, bullet, map);
  if (enemyThreat && enemyThreat.poisoned && frames !== Infinity) frames = Math.max(0, frames - 1);
  if (isEnemyThreatLine(pos, enemyThreat, map)) return Math.min(frames, 1);
  if (isPredictedEnemyThreatLine(pos, enemyThreat, map)) return Math.min(frames, 2);
  return frames;
}

function getDodgeInfo(myPos, myDir, bullet, enemyThreat, map, framesToHit) {
  var dirs = ["up", "right", "down", "left"];
  var best = null;
  var minFrames = Infinity;
  for (var i = 0; i < dirs.length; i++) {
    var moveDir = dirs[i];
    var next = add(myPos, delta(moveDir));
    if (isPassable(next, map) && !isDangerousPosition(next, enemyThreat, bullet, map)) {
      var framesNeeded = (myDir === moveDir) ? 1 : 2;
      if (enemyThreat && (enemyThreat.control || enemyThreat.poisoned) && myDir !== moveDir) framesNeeded++;
      if (framesNeeded < framesToHit && framesNeeded < minFrames) {
        minFrames = framesNeeded;
        best = next;
      }
    }
  }
  return best ? { move: best, framesNeeded: minFrames } : null;
}

function isEnemyLineOfFire(pos, enemyTank, map) {
  return enemyTank ? isLineThreat(pos, enemyTank.position, enemyTank.direction, map) : false;
}

function getDodgeFromLineOfFire(myPos, myDir, targetDir, map, enemyThreat, bullet) {
   var dirs = ["up", "right", "down", "left"];
   var best = null;
   var minF = Infinity;
   for(var i=0; i<dirs.length; i++) {
       var d = dirs[i];
       if (isPerpendicular(d, targetDir)) {
           var next = add(myPos, delta(d));
           if (isPassable(next, map) && !isDangerousPosition(next, enemyThreat, bullet, map)) {
               var f = (myDir === d) ? 1 : 2;
               if (enemyThreat && (enemyThreat.control || enemyThreat.poisoned) && myDir !== d) f++;
               if (f < minF) { minF = f; best = next; }
           }
       }
   }
   return best;
}

function isPerpendicular(dir1, dir2) {
   var d1 = delta(dir1);
   var d2 = delta(dir2);
   return (d1[0]*d2[0] + d1[1]*d2[1]) === 0;
}

function bfs(start, goal, map, bullet, enemyThreat, avoidLineOfFire) {
  // --- 核心优化 3: 动作经济与权重寻路 (性能修复版) ---
  // 使用简单的 BFS 结构，但优先处理不改变方向的节点，以减少转向。
  // 同时增加最大搜索深度限制，防止 runTime 错误。
  var queue = [{ pos: start, first: null, dir: null, depth: 0 }];
  var seen = {};
  seen[key(start)] = true;
  var maxDepth = 150; // 安全搜索深度限制

  for (var head = 0; head < queue.length; head++) {
    var current = queue[head];
    if (samePos(current.pos, goal)) return current.first;
    if (current.depth > maxDepth) continue;

    var dirs = ["up", "right", "down", "left"];
    // 优先尝试当前方向，以减少转向成本
    if (current.dir) {
        var dirIdx = dirs.indexOf(current.dir);
        if (dirIdx > -1) {
            dirs.splice(dirIdx, 1);
            dirs.unshift(current.dir);
        }
    }

    for (var i = 0; i < dirs.length; i++) {
      var d = dirs[i];
      var nextPos = add(current.pos, delta(d));
      var k = key(nextPos);
      
      if (seen[k] || !isPassable(nextPos, map)) continue;
      
      // 危险校验
      var isImmediateDanger = false;
      if (bullet) {
          var fToHitNext = getFramesToThreat(nextPos, bullet, enemyThreat, map);
          if (current.first === null && fToHitNext <= 2) isImmediateDanger = true;
      }
      var isLoF = avoidLineOfFire && (isEnemyThreatLine(nextPos, enemyThreat, map) || (current.first === null && isPredictedEnemyThreatLine(nextPos, enemyThreat, map)));
      if (isImmediateDanger || isLoF) continue;

      seen[k] = true;
      var newItem = { pos: nextPos, first: current.first || nextPos, dir: d, depth: current.depth + 1 };
      
      // 核心战术：如果不转向，放在队列前面（优先处理），否则放在后面
      if (current.dir === d) {
          queue.splice(head + 1, 0, newItem);
      } else {
          queue.push(newItem);
      }
    }
  }
  return null;
}

function moveToward(me, currentDir, from, to) {
  var dir = directionTo(from, to);
  if (currentDir === dir) me.go();
  else me.turn(dir);
}

function canShoot(a, b, map) {
  if (a[0] !== b[0] && a[1] !== b[1]) return false;
  var dir = directionTo(a, b);
  var step = delta(dir);
  var pos = add(a, step);
  while (!samePos(pos, b)) {
    if (!isTransparent(pos, map)) return false;
    pos = add(pos, step);
  }
  return true;
}

function directionTo(a, b) {
  if (b[0] > a[0]) return "right";
  if (b[0] < a[0]) return "left";
  if (b[1] > a[1]) return "down";
  return "up";
}

function delta(dir) {
  if (dir === "up") return [0, -1];
  if (dir === "right") return [1, 0];
  if (dir === "down") return [0, 1];
  return [-1, 0];
}

function add(pos, d) {
  return [pos[0] + d[0], pos[1] + d[1]];
}

function isPassable(pos, map) {
  if (!map || !map[pos[0]]) return false;
  var tile = map[pos[0]][pos[1]];
  if (tile === undefined) return false;
  return tile === "." || tile === "s" || tile === "b" || tile === "o"; 
}

function isTransparent(pos, map) {
  if (!map || !map[pos[0]]) return false;
  var tile = map[pos[0]][pos[1]];
  if (tile === undefined) return false;
  return tile === "." || tile === "s" || tile === "w" || tile === "o";
}

function samePos(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function key(pos) {
  return pos[0] + "," + pos[1];
}
