// simulate/engine.js
// 本地对战模拟物理引擎

const vm = require('vm');
const maps = require('./maps');

const COOLDOWNS = {
    shield: 25,
    freeze: 29,
    stun: 20,
    overload: 32,
    cloak: 35,
    poison: 20,
    teleport: 40,
    boost: 26
};

const DURATION = {
    shield: 4,
    freeze: 2,
    stun: 6,
    overload: 10,
    cloak: 6,
    poison: 4,
    boost: 6
};

// 辅助向量
const delta = {
    up: [0, -1],
    right: [1, 0],
    down: [0, 1],
    left: [-1, 0]
};

const turnLeft = { up: "left", left: "down", down: "right", right: "up" };
const turnRight = { up: "right", right: "down", down: "left", left: "up" };

function getTurnDir(current, target) {
    if (current === target) return null;
    const dirs = ["up", "right", "down", "left"];
    const curIdx = dirs.indexOf(current);
    const tarIdx = dirs.indexOf(target);
    if (curIdx === -1 || tarIdx === -1) return "right";
    const clockwise = (tarIdx - curIdx + 4) % 4;
    return clockwise === 3 ? "left" : "right";
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function getDist(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function recordEvent(events, ev) {
    events.push(ev);
}

function directionTo(a, b) {
    if (b[0] > a[0]) return "right";
    if (b[0] < a[0]) return "left";
    if (b[1] > a[1]) return "down";
    return "up";
}

// 模拟引擎主入口
function runSimulation(challengerCode, defenderCode, mapId) {
    const mapConfig = maps.getMap(mapId);
    const map = clone(mapConfig.map);
    const width = mapConfig.width;
    const height = mapConfig.height;

    // 创建双方 VM 沙盒，持久存储 G_History / G_Blueprint
    const sandboxes = [
        createSandbox(challengerCode),
        createSandbox(defenderCode)
    ];

    // 初始化对战状态
    const players = [
        {
            index: 0,
            name: "Challenger",
            tank: { id: 1, position: clone(mapConfig.spawns[0]), direction: "right", crashed: false },
            skillType: "teleport", // 默认技能
            cooldown: 0,
            effects: { self: null, debuff: null },
            status: { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false },
            bullet: null,
            stars: 0,
            pendingActions: [],
            teleportFireLockTimer: 0,
            boostRemaining: 0,
            shieldCharges: 0,
            overloadArmed: false,
            logs: []
        },
        {
            index: 1,
            name: "Defender",
            tank: { id: 2, position: clone(mapConfig.spawns[1]), direction: "left", crashed: false },
            skillType: "cloak", // 默认技能
            cooldown: 0,
            effects: { self: null, debuff: null },
            status: { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false },
            bullet: null,
            stars: 0,
            pendingActions: [],
            teleportFireLockTimer: 0,
            boostRemaining: 0,
            shieldCharges: 0,
            overloadArmed: false,
            logs: []
        }
    ];

    // 从 VM 中动态获取真实的技能设置，如果没有设置则自动赋予
    detectSkill(sandboxes[0], players[0]);
    detectSkill(sandboxes[1], players[1]);

    let starPos = null;
    let lastStarCollectedFrame = -100; // 避免星星刷得太快
    let frame = 0;
    const maxFrames = 300;
    const records = [];

    // 物理层判断此位置是否可以通过
    function isPassable(pos) {
        if (pos[0] < 0 || pos[0] >= width || pos[1] < 0 || pos[1] >= height) return false;
        const tile = map[pos[0]][pos[1]];
        return tile !== "x" && tile !== "m";
    }

    // 判断格子上是否有未损毁的坦克
    function isTankOn(pos, excludeIndex) {
        return players.some((p, idx) => {
            if (idx === excludeIndex || p.tank.crashed) return false;
            return p.tank.position[0] === pos[0] && p.tank.position[1] === pos[1];
        });
    }

    // 游戏主循环
    while (frame < maxFrames) {
        frame++;
        const frameEvents = [];

        // 1. 衰减状态时间与冷却
        players.forEach(p => {
            if (p.cooldown > 0) p.cooldown--;
            if (p.teleportFireLockTimer > 0) {
                p.teleportFireLockTimer--;
                if (p.teleportFireLockTimer === 0) p.status.fireLocked = false;
            }
            if (p.boostRemaining > 0) p.boostRemaining--;

            // Self effects
            if (p.effects.self) {
                p.effects.self.remainingFrames--;
                if (p.effects.self.remainingFrames <= 0) {
                    const expiredSkill = p.effects.self.type;
                    p.effects.self = null;
                    p.shieldCharges = 0;
                    p.overloadArmed = false;
                    p.status.shielded = false;
                    p.status.cloaked = false;
                    p.status.boosted = false;
                    p.status.overloaded = false;
                    recordEvent(frameEvents, { event: "skill_expired", tank: p.name, skill: expiredSkill, frame });
                }
            }

            // Debuffs
            if (p.effects.debuff) {
                p.effects.debuff.remainingFrames--;
                if (p.effects.debuff.remainingFrames <= 0) {
                    const expiredDebuff = p.effects.debuff.type;
                    p.effects.debuff = null;
                    p.status.frozen = false;
                    p.status.stunned = false;
                    p.status.poisoned = false;
                    recordEvent(frameEvents, { event: "debuff_expired", tank: p.name, skill: expiredDebuff, frame });
                }
            }
        });

        // 2. 刷新星星
        if (!starPos && (frame - lastStarCollectedFrame >= 12)) {
            // 随机找一个空地格子
            const openGround = [];
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    if (map[x][y] === "." && !isTankOn([x, y])) {
                        openGround.push([x, y]);
                    }
                }
            }
            if (openGround.length > 0) {
                // 使用简单确定性伪随机或者内置 Math.random
                const idx = Math.floor(Math.random() * openGround.length);
                starPos = openGround[idx];
                recordEvent(frameEvents, { event: "star_spawned", at: clone(starPos), frame });
            }
        }

        // 3. 执行双方 AI 收集 Action
        players.forEach((p, idx) => {
            if (p.tank.crashed) return;

            // 定身判定（冰冻和眩晕均限制行动，中毒判定隔帧生效限制）
            if (p.status.frozen) return;
            if (p.status.poisoned && frame % 2 === 0) return; // 毒雾一帧动一帧不动

            // 构造 runtime 对象传入 VM 沙盒中执行
            p.logs = [];
            const meObj = buildMeRuntime(p);
            const enemyObj = buildEnemyRuntime(players[1 - idx], p);
            const gameObj = {
                map: clone(map),
                star: starPos ? clone(starPos) : null,
                frames: frame
            };

            // 启动沙盒调用 onIdle
            try {
                // 灌入 me 队列调用，清除上一帧剩余
                p.pendingActions = [];
                const sandbox = sandboxes[idx];
                sandbox.me = meObj;
                sandbox.enemy = enemyObj;
                sandbox.game = gameObj;

                vm.runInContext("if (typeof onIdle === 'function') onIdle(me, enemy, game);", sandbox);
                
                // 记录 speak 事件到帧记录
                p.logs.forEach(msg => {
                    recordEvent(frameEvents, { event: "speak", tank: p.name, message: msg, frame });
                });
            } catch (err) {
                console.error(`[Engine] ${p.name} runtime error:`, err.message);
                p.tank.crashed = true;
                recordEvent(frameEvents, { event: "crashed", tank: p.name, by: "runtime_error", error: err.message, frame });
            }
        });

        // 4. 解析与执行双方 Action 队列（一帧执行一个动作）
        players.forEach((p, idx) => {
            if (p.tank.crashed || p.status.frozen) return;
            if (p.pendingActions.length === 0) return;

            const action = p.pendingActions[0]; // 仅提取最前面的一条执行
            
            // 眩晕状态下，执行移动或转弯指令时有 50% 概率反向/错乱
            let finalAction = action;
            if (p.status.stunned && (action.type === "go" || action.type === "turn")) {
                if (Math.random() < 0.5) {
                    if (action.type === "turn") {
                        finalAction = { type: "turn", direction: action.direction === "left" ? "right" : "left" };
                    } else if (action.type === "go") {
                        // 倒车
                        finalAction = { type: "go", steps: -1 };
                    }
                }
            }

            if (finalAction.type === "turn") {
                const nextDir = turn(p.tank.direction, finalAction.direction);
                p.tank.direction = nextDir;
                recordEvent(frameEvents, { event: "turn", tank: p.name, direction: finalAction.direction, frame });
            } 
            else if (finalAction.type === "go") {
                const steps = finalAction.steps || 1;
                // 如果是 Boosted, 可以走两格
                const maxSteps = (p.status.boosted || p.boostRemaining > 0) ? 2 : 1;
                let moved = false;
                
                // 走 steps 步（可能Boost两格）
                for (let stepIdx = 0; stepIdx < maxSteps; stepIdx++) {
                    const stepDir = steps < 0 ? turn(turn(p.tank.direction, "left"), "left") : p.tank.direction; // 倒车判断
                    const d = delta[stepDir];
                    const nextPos = [p.tank.position[0] + d[0], p.tank.position[1] + d[1]];

                    // 物理通过检测 & 坦克相撞检测
                    if (isPassable(nextPos) && !isTankOn(nextPos, idx)) {
                        p.tank.position = nextPos;
                        moved = true;
                    } else {
                        break; // 撞墙/撞人直接被卡住，终止本次前进
                    }
                }
                if (moved) {
                    recordEvent(frameEvents, { event: "move", tank: p.name, to: clone(p.tank.position), frame });
                }
            } 
            else if (finalAction.type === "fire") {
                if (!p.status.fireLocked && !p.bullet) {
                    // 发射子弹
                    p.bullet = {
                        id: `bullet-${p.name}-${frame}`,
                        position: clone(p.tank.position),
                        direction: p.tank.direction,
                        shooter: p.name
                    };
                    recordEvent(frameEvents, { event: "fire", tank: p.name, bullet: p.bullet.id, direction: p.tank.direction, frame });

                    // 如果处于过载激活期，下一次成功发射生成两个子弹！
                    if (p.overloadArmed) {
                        // 寻找侧边相邻格子生成双弹
                        const spawnOffsetPos = clone(p.tank.position);
                        if (p.tank.direction === "up" || p.tank.direction === "down") spawnOffsetPos[0] += 1;
                        else spawnOffsetPos[1] += 1;
                        
                        p.extraBullet = {
                            id: `bullet-${p.name}-${frame}-o`,
                            position: spawnOffsetPos,
                            direction: p.tank.direction,
                            shooter: p.name
                        };
                        recordEvent(frameEvents, { event: "fire", tank: p.name, bullet: p.extraBullet.id, direction: p.tank.direction, isOverload: true, frame });

                        p.overloadArmed = false;
                        p.effects.self = null;
                        p.status.overloaded = false;
                    }
                }
            } 
            else if (finalAction.type === "skill") {
                executeSkill(p, players[1 - idx], frameEvents, finalAction.target);
            }
        });

        // 5. 拾取星星检测
        players.forEach(p => {
            if (p.tank.crashed) return;
            if (starPos && p.tank.position[0] === starPos[0] && p.tank.position[1] === starPos[1]) {
                p.stars++;
                recordEvent(frameEvents, { event: "star_collected", tank: p.name, at: clone(starPos), frame });
                starPos = null;
                lastStarCollectedFrame = frame;
            }
        });

        // 6. 飞子弹并进行撞击判定（子弹一帧移动 2 格，每格均判断碰撞）
        for (let subStep = 0; subStep < 2; subStep++) {
            players.forEach(p => {
                const bullets = [p.bullet, p.extraBullet].filter(Boolean);
                bullets.forEach((b, bIdx) => {
                    const d = delta[b.direction];
                    const nextBPos = [b.position[0] + d[0], b.position[1] + d[1]];
                    b.position = nextBPos;

                    // 1. 越界撞墙
                    if (nextBPos[0] < 0 || nextBPos[0] >= width || nextBPos[1] < 0 || nextBPos[1] >= height) {
                        recordEvent(frameEvents, { event: "shot_wall", tank: p.name, bullet: b.id, at: nextBPos, frame });
                        destroyBullet(p, bIdx);
                        return;
                    }
                    const tile = map[nextBPos[0]][nextBPos[1]];
                    if (tile === "x") {
                        recordEvent(frameEvents, { event: "shot_wall", tank: p.name, bullet: b.id, at: nextBPos, frame });
                        destroyBullet(p, bIdx);
                        return;
                    }
                    // 2. 撞土堆
                    if (tile === "m") {
                        map[nextBPos[0]][nextBPos[1]] = "."; // 变成地
                        recordEvent(frameEvents, { event: "shot_mound", tank: p.name, bullet: b.id, at: nextBPos, frame });
                        destroyBullet(p, bIdx);
                        return;
                    }
                    // 3. 击中坦克
                    const hitIndex = players.findIndex(t => !t.tank.crashed && t.tank.position[0] === nextBPos[0] && t.tank.position[1] === nextBPos[1]);
                    if (hitIndex !== -1) {
                        const target = players[hitIndex];
                        // 护盾检测
                        if (target.status.shielded && target.shieldCharges > 0) {
                            target.shieldCharges = 0;
                            target.status.shielded = false;
                            target.effects.self = null;
                            recordEvent(frameEvents, { event: "shield_blocked", tank: target.name, bullet: b.id, frame });
                        } else {
                            target.tank.crashed = true;
                            recordEvent(frameEvents, { event: "crashed", tank: target.name, by: p.name, bullet: b.id, frame });
                        }
                        destroyBullet(p, bIdx);
                    }
                });
            });
        }

        // 7. 结算胜负
        const aliveCount = players.filter(p => !p.tank.crashed).length;
        if (aliveCount === 0) {
            // 平局
            records.push(frameEvents);
            return endMatch(records, mapConfig.map, players, null, "both_crashed");
        } else if (aliveCount === 1) {
            // 单独存活方获胜
            const winner = players.find(p => !p.tank.crashed);
            records.push(frameEvents);
            return endMatch(records, mapConfig.map, players, winner, "crashed");
        }

        records.push(frameEvents);
    }

    // 超时胜负结算 (以星星多者获胜；若星星相同，以离最后一颗星星近者获胜)
    let winner = null;
    if (players[0].stars !== players[1].stars) {
        winner = players[0].stars > players[1].stars ? players[0] : players[1];
    } else if (starPos) {
        const d0 = getDist(players[0].tank.position, starPos);
        const d1 = getDist(players[1].tank.position, starPos);
        if (d0 !== d1) {
            winner = d0 < d1 ? players[0] : players[1];
        }
    }
    return endMatch(records, mapConfig.map, players, winner, "timeout");
}

function destroyBullet(player, bulletIdx) {
    if (bulletIdx === 0) player.bullet = null;
    else player.extraBullet = null;
}

function turn(current, commandDir) {
    return commandDir === "left" ? turnLeft[current] : turnRight[current];
}

// 执行技能
function executeSkill(p, enemy, events, target) {
    const type = p.skillType;
    p.cooldown = COOLDOWNS[type];
    recordEvent(events, { event: "skill_cast", tank: p.name, skill: type, frame: events.frame });

    if (type === "shield" || type === "cloak" || type === "boost" || type === "overload") {
        p.effects.self = { type, remainingFrames: DURATION[type] };
        p.status.shielded = type === "shield";
        p.status.cloaked = type === "cloak";
        p.status.boosted = type === "boost";
        p.status.overloaded = type === "overload";
        if (type === "shield") p.shieldCharges = 1;
        if (type === "overload") p.overloadArmed = true;
        if (type === "boost") p.boostRemaining = DURATION.boost;
        recordEvent(events, { event: "skill_applied", tank: p.name, skill: type, duration: DURATION[type], frame: events.frame });
    } 
    else if (type === "teleport") {
        if (!target) return;
        const from = clone(p.tank.position);
        p.tank.position = clone(target);
        
        // 判断离敌人距离，Manhattan 距离 <= 4 时，开火锁定 2 帧
        const dist = getDist(p.tank.position, enemy.tank.position);
        p.status.fireLocked = dist <= 4;
        p.teleportFireLockTimer = dist <= 4 ? 2 : 0;
        
        recordEvent(events, { event: "skill_applied", tank: p.name, skill: "teleport", from, to: clone(target), frame: events.frame });
    } 
    else {
        // Debuff 技能
        enemy.effects.debuff = { type, remainingFrames: DURATION[type] };
        enemy.status.frozen = type === "freeze";
        enemy.status.stunned = type === "stun";
        enemy.status.poisoned = type === "poison";
        recordEvent(events, { event: "skill_applied", tank: enemy.name, skill: type, duration: DURATION[type], frame: events.frame });
    }
}

// 对局结算封装
function endMatch(records, initialMap, players, winner, reason) {
    const p0 = players[0];
    const p1 = players[1];
    return {
        map: { map: initialMap },
        names: [p0.name, p1.name],
        replay: {
            meta: {
                players: [
                    { tank: { id: p0.tank.id, position: p0.tank.position, direction: p0.tank.direction } },
                    { tank: { id: p1.tank.id, position: p1.tank.position, direction: p1.tank.direction } }
                ],
                result: {
                    winner: winner ? winner.index : -1, // -1 表示平局
                    reason: reason
                }
            },
            records: records
        }
    };
}

// 自动检测技能类型
function detectSkill(sandbox, player) {
    const newTankCode = sandbox;
    if (newTankCode.onIdle) {
        // 沙箱运行后检测 onIdle 内引用的技能命令，设定默认技能
        const codeText = newTankCode.onIdle.toString();
        if (codeText.includes("me.teleport")) player.skillType = "teleport";
        else if (codeText.includes("me.shield")) player.skillType = "shield";
        else if (codeText.includes("me.freeze")) player.skillType = "freeze";
        else if (codeText.includes("me.stun")) player.skillType = "stun";
        else if (codeText.includes("me.overload")) player.skillType = "overload";
        else if (codeText.includes("me.cloak")) player.skillType = "cloak";
        else if (codeText.includes("me.poison")) player.skillType = "poison";
        else if (codeText.includes("me.boost")) player.skillType = "boost";
    }
}

// 创建虚拟运行沙盒
function createSandbox(codeText) {
    const sandbox = {
        G_Blueprint: {},
        G_History: {},
        CONFIG: {},
        console: {
            log: function(...args) {
                console.log("[Console]", ...args);
            }
        },
        print: function(...args) {
            console.error("[Code Print]", ...args);
        },
        Math: Math,
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Boolean: Boolean,
        Date: Date,
        speak: function() {}
    };
    vm.createContext(sandbox);
    vm.runInContext(codeText, sandbox);
    return sandbox;
}

// 构造传递给代码的 me 对象
function buildMeRuntime(p) {
    const me = {
        tank: {
            id: p.tank.id,
            position: clone(p.tank.position),
            direction: p.tank.direction,
            crashed: p.tank.crashed
        },
        stars: p.stars,
        bullet: p.bullet ? { position: clone(p.bullet.position), direction: p.bullet.direction } : null,
        skill: {
            type: p.skillType,
            cooldownFrames: COOLDOWNS[p.skillType],
            remainingCooldownFrames: p.cooldown,
            activeRemainingFrames: p.effects.self ? p.effects.self.remainingFrames : 0,
            activeType: p.effects.self ? p.effects.self.type : null
        },
        effects: clone(p.effects),
        status: clone(p.status),
        // 绑定动作指令
        go: function(steps) { p.pendingActions.push({ type: "go", steps: steps || 1 }); },
        turn: function(dir) { p.pendingActions.push({ type: "turn", direction: dir }); },
        fire: function() { p.pendingActions.push({ type: "fire" }); },
        throwBomb: function() { /* 本地简易引擎暂不处理炸弹 */ },
        speak: function(msg) { p.logs.push(msg); }
    };
    // 防御性注入全部 8 种技能的 API 方法，防止因代码直接调用非识别技能导致 Reference 崩溃
    me.shield = function() { p.pendingActions.push({ type: "skill" }); };
    me.freeze = function() { p.pendingActions.push({ type: "skill" }); };
    me.stun = function() { p.pendingActions.push({ type: "skill" }); };
    me.overload = function() { p.pendingActions.push({ type: "skill" }); };
    me.cloak = function() { p.pendingActions.push({ type: "skill" }); };
    me.poison = function() { p.pendingActions.push({ type: "skill" }); };
    me.boost = function() { p.pendingActions.push({ type: "skill" }); };
    me.teleport = function(x, y) { p.pendingActions.push({ type: "skill", target: [x, y] }); };
    
    return me;
}

// 构造传递给代码的 enemy 对象
function buildEnemyRuntime(enemy, self) {
    const enemyInGrass = false; // 简易引擎先不处理隐身草丛
    const visible = !enemy.status.cloaked && !enemyInGrass;
    
    // 子弹可见性检测：子弹必须在视线方向上
    let visibleEnemyB = null;
    if (enemy.bullet) {
        visibleEnemyB = { position: clone(enemy.bullet.position), direction: enemy.bullet.direction };
    }

    return {
        tank: visible ? {
            id: enemy.tank.id,
            position: clone(enemy.tank.position),
            direction: enemy.tank.direction,
            crashed: enemy.tank.crashed
        } : null,
        bullet: visibleEnemyB,
        stars: enemy.stars,
        skill: {
            type: enemy.skillType,
            cooldownFrames: COOLDOWNS[enemy.skillType],
            remainingCooldownFrames: enemy.cooldown,
            activeRemainingFrames: enemy.effects.self ? enemy.effects.self.remainingFrames : 0,
            activeType: enemy.effects.self ? enemy.effects.self.type : null
        },
        effects: clone(enemy.effects),
        status: clone(enemy.status)
    };
}

module.exports = {
    runSimulation
};
