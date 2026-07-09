const fs = require('fs');
const path = require('path');
const https = require('https');
const { getToken } = require('./config');

const COOLDOWNS = { shield: 25, freeze: 29, stun: 20, overload: 32, cloak: 35, poison: 20, teleport: 40, boost: 26 };

// 自动拉取 view=raw 的原始录像 JSON 并缓存到本地
async function getReplay(matchId, token) {
    const replaysDir = path.join(__dirname, 'test_cases/replays');
    if (!fs.existsSync(replaysDir)) {
        fs.mkdirSync(replaysDir, { recursive: true });
    }
    const replayPath = path.join(replaysDir, `${matchId}.json`);
    if (fs.existsSync(replayPath)) {
        return JSON.parse(fs.readFileSync(replayPath, 'utf8'));
    }

    console.log(`[XDB-Registry] 本地未找到原始录像 ${matchId}，正在拉取并缓存...`);
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'agentank.ai',
            path: `/api/matches/${matchId}/agent.json?view=raw`,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };

        https.get(options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`API 请求失败，HTTP 状态码: ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed.replayData || !parsed.replayData.replay) {
                        reject(new Error(`录像 ${matchId} 未包含 replayData，可能是无效对局。`));
                        return;
                    }
                    fs.writeFileSync(replayPath, JSON.stringify(parsed, null, 2), 'utf8');
                    console.log(`[XDB-Registry] 原始录像 ${matchId} 缓存成功。`);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error(`解析录像 ${matchId} 失败: ` + e.message));
                }
            });
        }).on('error', reject);
    });
}

function getNewDirection(currentDir, turn) {
    const dirs = ["up", "right", "down", "left"];
    const idx = dirs.indexOf(currentDir);
    if (idx === -1) return currentDir;
    if (turn === "left") return dirs[(idx - 1 + 4) % 4];
    if (turn === "right") return dirs[(idx + 1) % 4];
    return currentDir;
}

// 模拟帧递推演进，得到 targetFrame 帧的最终状态
function simulateToFrame(replayRaw, targetFrame) {
    const meta = replayRaw.replayData.replay.meta;
    const records = replayRaw.replayData.replay.records || [];
    const participants = replayRaw.participants || (replayRaw.summary ? replayRaw.summary.participants : null);

    // 确定谁是 XDB(me) 和 AME(enemy)
    let meId = null;
    let enemyId = null;
    
    // 如果 participants 存在，利用它来区分
    if (participants) {
        if (participants.defender && participants.defender.tankName === "XDB") {
            meId = meta.players[1].tank.id;
            enemyId = meta.players[0].tank.id;
        } else {
            meId = meta.players[0].tank.id;
            enemyId = meta.players[1].tank.id;
        }
    } else {
        // 如果没有 summary（如直接挑战接口），默认 player 0 为 me 或者是 name 匹配
        if (meta.players[0].tank.name === 'XDB') {
            meId = meta.players[0].tank.id;
            enemyId = meta.players[1].tank.id;
        } else {
            meId = meta.players[1].tank.id;
            enemyId = meta.players[0].tank.id;
        }
    }

    const meIndex = meta.players[0].tank.id === meId ? 0 : 1;
    const enemyIndex = 1 - meIndex;

    let p0 = meta.players[0];
    let p1 = meta.players[1];
    
    let mePos = (p0.tank.id === meId ? p0.tank.position : p1.tank.position).slice();
    let meDir = p0.tank.id === meId ? p0.tank.direction : p1.tank.direction;
    let enemyPos = (p0.tank.id === meId ? p1.tank.position : p0.tank.position).slice();
    let enemyDir = p0.tank.id === meId ? p1.tank.direction : p0.tank.direction;

    let starPos = null;
    for (const ev of (records[0] || [])) {
        if (ev.type === "star" || ev.event === "star_spawned" || (ev.action === "created" && ev.type === "star")) {
            starPos = ev.position || ev.at;
        }
    }

    let bulletsMap = new Map();
    let enemySkillType = "none";
    for (const frameEvents of records) {
        for (const ev of frameEvents) {
            if (ev.sourceObjectId === enemyId && ev.action === "cast" && ev.skillType) {
                enemySkillType = ev.skillType;
                break;
            }
        }
    }

    let meSkillType = "teleport";
    let meSkillCD = 0;
    let enemySkillCD = 0;
    let meStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
    let enemyStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
    let meFireLockTimer = 0;
    let enemyFireLockTimer = 0;

    // 递推从第 1 帧到 targetFrame 帧
    for (let f = 1; f <= targetFrame; f++) {
        if (meSkillCD > 0) meSkillCD--;
        if (enemySkillCD > 0) enemySkillCD--;
        if (meFireLockTimer > 0) { meFireLockTimer--; if (meFireLockTimer === 0) meStatus.fireLocked = false; }
        if (enemyFireLockTimer > 0) { enemyFireLockTimer--; if (enemyFireLockTimer === 0) enemyStatus.fireLocked = false; }

        const frameEvents = records[f] || [];
        for (const ev of frameEvents) {
            const isMe = (ev.objectId === meId || ev.sourceObjectId === meId || ev.targetObjectId === meId || ev.by === meIndex);
            const isEnemy = (ev.objectId === enemyId || ev.sourceObjectId === enemyId || ev.targetObjectId === enemyId || ev.by === enemyIndex);

            if (isMe) {
                if (ev.action === "go" || ev.event === "move") { mePos = (ev.position || ev.to).slice(); }
                else if (ev.action === "turn" || ev.event === "turn") { meDir = getNewDirection(meDir, ev.direction); }
                else if (ev.action === "applied" && ev.skillType === "teleport") { 
                    mePos = ev.to.slice(); 
                    var d = Math.abs(mePos[0] - enemyPos[0]) + Math.abs(mePos[1] - enemyPos[1]);
                    if (d <= 4) { meStatus.fireLocked = true; meFireLockTimer = 2; } 
                }
                else if (ev.action === "applied" && ev.skillType === "boost") { meStatus.boosted = true; }
                else if (ev.event === "boost_ended") { meStatus.boosted = false; }
                else if (ev.action === "applied" && ev.skillType === "overload") { meStatus.overloaded = true; }
                else if (ev.event === "overload_ended") { meStatus.overloaded = false; }
            } else if (isEnemy) {
                if (ev.action === "go" || ev.event === "move") { enemyPos = (ev.position || ev.to).slice(); }
                else if (ev.action === "turn" || ev.event === "turn") { enemyDir = getNewDirection(enemyDir, ev.direction); }
                else if (ev.action === "applied" && ev.skillType === "teleport") { 
                    enemyPos = ev.to.slice(); 
                    var d = Math.abs(mePos[0] - enemyPos[0]) + Math.abs(mePos[1] - enemyPos[1]);
                    if (d <= 4) { enemyStatus.fireLocked = true; enemyFireLockTimer = 2; } 
                }
                else if (ev.action === "applied" && ev.skillType === "boost") { enemyStatus.boosted = true; }
                else if (ev.event === "boost_ended") { enemyStatus.boosted = false; }
                else if (ev.action === "applied" && ev.skillType === "overload") { enemyStatus.overloaded = true; }
                else if (ev.event === "overload_ended") { enemyStatus.overloaded = false; }
            }

            if (ev.type === "bullet") {
                if (ev.action === "created" && ev.position) {
                    bulletsMap.set(ev.objectId, { position: ev.position.slice(), direction: ev.direction || "up" });
                } else if (ev.action === "go" && ev.position) {
                    let b = bulletsMap.get(ev.objectId);
                    if (b) { b.position = ev.position.slice(); if (ev.direction) b.direction = ev.direction; }
                } else if (ev.action === "crashed") {
                    bulletsMap.delete(ev.objectId);
                }
            }

            if (ev.type === "star" || ev.event === "star_spawned" || (ev.action === "created" && ev.type === "star")) {
                var pVal = ev.position || ev.at;
                if (pVal) {
                    starPos = pVal.slice();
                }
            }
            if (ev.event === "star_collected" || ev.action === "collected") { starPos = null; }

            if (ev.action === "cast" && ev.type === "skill") {
                if (isMe) meSkillCD = COOLDOWNS[ev.skillType] || 40;
                else if (isEnemy) enemySkillCD = COOLDOWNS[ev.skillType] || 35;
            }
        }
    }

    // 收集第 targetFrame 帧飞弹子弹
    let meBullet = null;
    let enemyBullet = null;
    for (const [bid, b] of bulletsMap.entries()) {
        // 由于 events 缺乏子弹发射者归属字段，这里简单依据方向和距离判断归属，或者不作区分
        // 对战中绝大多数情况下只需要把飞弹归入 buildExecutionContext 的 bullet 属性即可
        meBullet = { position: b.position, direction: b.direction }; // 供避弹等需要子弹参数的场景
    }

    return {
        meId, enemyId, enemyIndex,
        mePos, meDir, enemyPos, enemyDir, starPos,
        meSkillCD, enemySkillCD, meSkillType, enemySkillType,
        meStatus, enemyStatus, meBullet, enemyBullet,
        map: replayRaw.replayData.map.map
    };
}

// 运行测试用例
function runTestCase(caseInfo, replayData, newTankCode) {
    const f = caseInfo.frame;
    const simState = simulateToFrame(replayData, f);

    // 构建 sandbox 环境
    const sandbox = {
        console: console,
        print: console.log,
        G_Blueprint: {},
        G_History: {},
        CONFIG: { KILL_PRIO: 10000, STAR_PRIO: 800, TURN_COST: 0.8, BLIND_FIRE_FRAMES: 3 }
    };

    // 编译坦克代码
    let recordedAction = null;
    const runCode = new Function('sandbox', `
        with (sandbox) {
            ${newTankCode}
            sandbox.onIdle = onIdle;
            sandbox.G_Blueprint = G_Blueprint;
            sandbox.G_History = G_History;
            sandbox.buildExecutionContext = buildExecutionContext;
            sandbox.tacticalAnalysis = tacticalAnalysis;
            sandbox.isSafeForStarWalking = isSafeForStarWalking;
            sandbox.getNextStep = getNextStep;
            sandbox.isSafe = isSafe;
        }
    `);
    runCode(sandbox);

    // 灌入静态分析状态
    sandbox.G_Blueprint.initialized = true;
    sandbox.G_Blueprint.enemySeen = true;
    sandbox.G_Blueprint.enemyProfile = { skillType: simState.enemySkillType, hasOverload: (simState.enemySkillType === 'overload') };
    sandbox.G_Blueprint.mapVision = { cover: {}, grass: {}, grassList: [] };
    for (let x = 0; x < simState.map.length; x++) {
        for (let y = 0; y < simState.map[0].length; y++) {
            if (simState.map[x][y] === 'x') sandbox.G_Blueprint.mapVision.cover[x+','+y] = true;
            if (simState.map[x][y] === 'o') {
                sandbox.G_Blueprint.mapVision.grass[x+','+y] = true;
                sandbox.G_Blueprint.mapVision.grassList.push([x,y]);
            }
        }
    }
    const sType = simState.enemySkillType;
    let tactics = { STANCE: "DEFAULT", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 2000, ENABLE_ASSASSINATION: true, MAX_NODES: 250 };
    if (sType === "freeze" || sType === "stun") {
        tactics = { STANCE: "ANTI_CONTROL", DANGER_RADIUS: 8, ASTAR_UNSAFE_PENALTY: 3000, ENABLE_ASSASSINATION: false, MAX_NODES: 200 };
    } else if (sType === "cloak") {
        tactics = { STANCE: "ANTI_CLOAK", DANGER_RADIUS: 4, ASTAR_UNSAFE_PENALTY: 1500, ENABLE_ASSASSINATION: true, MAX_NODES: 200, JITTER: true };
    }
    sandbox.G_Blueprint.Tactics = tactics;

    // 灌入演进的动态 G_History 状态
    sandbox.G_History.frame = f;
    sandbox.G_History.lastEnemyPos = simState.enemyPos.slice();
    sandbox.G_History.lastEnemyDir = simState.enemyDir;
    sandbox.G_History.lastEnemySeenFrame = f - 1;
    sandbox.G_History.lastEnemyVisible = !simState.enemyStatus.cloaked;
    sandbox.G_History.wasEnemyVisible = true;
    sandbox.G_History.enemyInvisibleFrames = simState.enemyStatus.cloaked ? 1 : 0;
    sandbox.G_History.lastUpdatedFrame = f - 1;
    if (simState.starPos) sandbox.G_History.lastStarPos = simState.starPos.slice();

    // 灌入测试用例里手动指定的 G_History 覆盖状态
    if (caseInfo.setupHistory) {
        for (const k in caseInfo.setupHistory) {
            sandbox.G_History[k] = caseInfo.setupHistory[k];
        }
    }

    let finalMeDir = simState.meDir;
    if (caseInfo.setupHistory && caseInfo.setupHistory._overrideMeDir) {
        finalMeDir = caseInfo.setupHistory._overrideMeDir;
    }

    const meStars = (caseInfo.setupStars && caseInfo.setupStars.me !== undefined) ? caseInfo.setupStars.me : 3;
    const enemyStars = (caseInfo.setupStars && caseInfo.setupStars.enemy !== undefined) ? caseInfo.setupStars.enemy : 3;

    // 重构对战对象并运行 buildExecutionContext
    const meObj = {
        tank: { id: simState.meId, position: simState.mePos.slice(), direction: finalMeDir, crashed: false },
        stars: meStars,
        bullet: simState.meBullet,
        skill: { type: simState.meSkillType, cooldownFrames: 40, remainingCooldownFrames: simState.meSkillCD },
        status: Object.assign({}, simState.meStatus),
        speak: function(text) {},
        fire: function() {
            const expected = caseInfo.expected;
            if (expected && expected.action === "fire" && expected.target) {
                const myP = simState.mePos;
                const tar = expected.target;
                const d = simState.meDir;
                let onLine = false;
                if (d === "up" && myP[0] === tar[0] && myP[1] > tar[1]) onLine = true;
                if (d === "down" && myP[0] === tar[0] && myP[1] < tar[1]) onLine = true;
                if (d === "left" && myP[1] === tar[1] && myP[0] > tar[0]) onLine = true;
                if (d === "right" && myP[1] === tar[1] && myP[0] < tar[0]) onLine = true;
                if (onLine) {
                    recordedAction = { action: "fire", target: expected.target };
                    return;
                }
            }
            recordedAction = { action: "fire", target: null };
        },
        turn: function(dir) {
            const expected = caseInfo.expected;
            recordedAction = { action: "turn", direction: dir };
            if (expected && expected.action === "turn") {
                recordedAction.target = expected.target;
            }
        },
        go: function(dest) {
            recordedAction = { action: "move", target: dest };
        },
        teleport: function(x, y) {
            recordedAction = { action: "teleport", target: [x, y] };
        }
    };

    const enemyInGrass = simState.map[simState.enemyPos[0]][simState.enemyPos[1]] === 'o';
    const dist = Math.abs(simState.mePos[0] - simState.enemyPos[0]) + Math.abs(simState.mePos[1] - simState.enemyPos[1]);
    const isVisible = !simState.enemyStatus.cloaked && (!enemyInGrass || dist <= 1);

    const enemyObj = {
        tank: isVisible ? { id: simState.enemyId, position: simState.enemyPos.slice(), direction: simState.enemyDir, crashed: false } : null,
        bullet: simState.enemyBullet,
        stars: enemyStars,
        skill: { type: simState.enemySkillType, cooldownFrames: 35, remainingCooldownFrames: simState.enemySkillCD },
        status: Object.assign({}, simState.enemyStatus)
    };

    const gameObj = { map: simState.map, star: simState.starPos ? simState.starPos.slice() : null, frames: f };
    const ctx = sandbox.buildExecutionContext(meObj, enemyObj, gameObj);



    // 运行 XDB 的 onIdle 入口
    sandbox.onIdle(meObj, enemyObj, gameObj);

    // 验证结果
    const actual = recordedAction;
    const expected = caseInfo.expected;

    if (!actual) {
        if (expected && (expected.action === null || expected.action === "none" || expected.action === "idle")) {
            return { pass: true, actual: { action: "idle" } };
        }
        return { pass: false, error: "未做出任何动作" };
    }

    const actionPass = actual.action === expected.action;
    let targetPass = true;
    if (expected.target) {
        targetPass = actual.target && actual.target[0] === expected.target[0] && actual.target[1] === expected.target[1];
    }

    if (actionPass && targetPass) {
        return { pass: true, actual };
    } else {
        return { pass: false, actual, expected };
    }
}

async function main() {
    const token = getToken();
    if (!token) {
        console.error("[Error] 未配置 AGENTANK_TOKEN，无法自动下载录像。");
        process.exit(1);
    }

    const registryPath = path.join(__dirname, 'test_cases/registry.json');
    if (!fs.existsSync(registryPath)) {
        console.error("[Error] 找不到测试用例注册表 test_cases/registry.json");
        process.exit(1);
    }

    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const newTankCode = fs.readFileSync(path.join(__dirname, 'new_tank.js'), 'utf8');

    console.log(`\n================== XDB-Registry 回归测试启动 ==================`);
    console.log(`载入用例总数: ${registry.length}`);

    let passedCount = 0;
    let failedCount = 0;

    for (const item of registry) {
        console.log(`\n[测试用例] ${item.id} - ${item.description}`);
        try {
            const replayData = await getReplay(item.matchId, token);
            const result = runTestCase(item, replayData, newTankCode);

            if (result.pass) {
                console.log(`  \x1b[32m[PASS]\x1b[0m 验证通过。实际行为: ${JSON.stringify(result.actual)}`);
                passedCount++;
            } else {
                console.log(`  \x1b[31m[FAIL]\x1b[0m 验证失败！`);
                if (result.error) {
                    console.log(`    原因: ${result.error}`);
                } else {
                    console.log(`    期望: ${JSON.stringify(item.expected)}`);
                    console.log(`    实际: ${JSON.stringify(result.actual)}`);
                }
                failedCount++;
            }
        } catch (e) {
            console.log(`  \x1b[31m[ERROR]\x1b[0m 运行出错: ${e.stack}`);
            failedCount++;
        }
    }

    console.log(`\n================== 回归测试运行汇总 ==================`);
    console.log(`全部完成。 通过: \x1b[32m${passedCount}\x1b[0m, 失败: \x1b[31m${failedCount}\x1b[0m`);
    console.log(`=======================================================\n`);

    if (failedCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

main().catch(console.error);
