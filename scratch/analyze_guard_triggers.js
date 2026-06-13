const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

// Reuse helper functions from simulate_match.js
function getNewDirection(currentDir, turn) {
    const dirs = ["up", "right", "down", "left"];
    const idx = dirs.indexOf(currentDir);
    if (idx === -1) return currentDir;
    if (turn === "left") return dirs[(idx - 1 + 4) % 4];
    if (turn === "right") return dirs[(idx + 1) % 4];
    return currentDir;
}

const COOLDOWNS = {
    shield: 32, freeze: 34, stun: 31, overload: 32, cloak: 32, poison: 34, teleport: 40, boost: 31
};

async function fetchMatchData(matchId, token) {
    const scratchDir = path.join(__dirname, 'temp_raws');
    if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
    }
    const rawPath = path.join(scratchDir, `${matchId}_raw.json`);
    const summaryPath = path.join(scratchDir, `${matchId}_summary.json`);

    if (!fs.existsSync(rawPath) || !fs.existsSync(summaryPath)) {
        if (!token) {
            console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
            process.exit(1);
        }

        const summaryRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!summaryRes.ok) return null;
        const summaryJson = await summaryRes.json();
        fs.writeFileSync(summaryPath, JSON.stringify(summaryJson, null, 2));

        const rawRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=raw`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!rawRes.ok) return null;
        const rawJson = await rawRes.json();
        fs.writeFileSync(rawPath, JSON.stringify(rawJson, null, 2));
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    return { summary, raw };
}

async function main() {
    const token = getToken();
    const reportPath = path.join(__dirname, '../evolution_report.json');
    if (!fs.existsSync(reportPath)) {
        console.error("Error: evolution_report.json not found.");
        process.exit(1);
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const matches = report.matches || [];

    // Load local code
    const newTankCode = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');

    console.log(`[Simulator] Starting simulation analysis of ${matches.length} matches to detect Guard/Delay triggers...`);

    let totalGuardFires = 0;
    let totalGuardTurns = 0;
    let totalGuardRuns = 0;
    let totalDelayWaits = 0;
    let totalDelayTurns = 0;

    for (const match of matches) {
        const urlId = match.matchUrlId;
        const opponent = match.opponent;
        const result = match.result;

        const data = await fetchMatchData(urlId, token);
        if (!data) {
            console.log(`➖ [对局 ${match.matchNum}] (${result.toUpperCase()}) 无法获取对局 ${urlId}`);
            continue;
        }

        const { summary, raw } = data;
        const records = raw.replayData.replay.records || [];
        const map = raw.replayData.map.map;
        const participants = summary.participants;

        let meId = null;
        if (participants.defender && participants.defender.tankName === "XDB") {
            meId = raw.replayData.replay.meta.players[1].tank.id;
        } else {
            meId = raw.replayData.replay.meta.players[0].tank.id;
        }
        const meIndex = raw.replayData.replay.meta.players[0].tank.id === meId ? 0 : 1;
        const enemyIndex = 1 - meIndex;
        const enemyId = raw.replayData.replay.meta.players[enemyIndex].tank.id;
        const enemyName = enemyIndex === 0 ? participants.challenger.tankName : participants.defender.tankName;

        let p0 = raw.replayData.replay.meta.players[0];
        let p1 = raw.replayData.replay.meta.players[1];
        let mePos = p0.tank.id === meId ? p0.tank.position : p1.tank.position;
        let meDir = p0.tank.id === meId ? p0.tank.direction : p1.tank.direction;
        let enemyPos = p0.tank.id === meId ? p1.tank.position : p0.tank.position;
        let enemyDir = p0.tank.id === meId ? p1.tank.direction : p0.tank.direction;

        let starPos = null;
        let bulletsMap = new Map();
        let meSkillCD = 0;
        let enemySkillCD = 0;
        let meSkillType = "teleport";
        let enemySkillType = "cloak";

        for (const frameEvents of records) {
            for (const ev of frameEvents) {
                if (ev.sourceObjectId === enemyId && ev.action === "cast" && ev.skillType) {
                    enemySkillType = ev.skillType;
                    break;
                }
            }
        }

        let meStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
        let enemyStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
        let meFireLockTimer = 0;
        let enemyFireLockTimer = 0;

        const sandbox = {
            G_Blueprint: null, G_History: null, CONFIG: null,
            print: function() {},
        };

        const runCode = new Function('sandbox', `
            with (sandbox) {
                ${newTankCode}
                sandbox.onIdle = onIdle;
                sandbox.G_Blueprint = G_Blueprint;
                sandbox.G_History = G_History;
                sandbox.CONFIG = CONFIG;
                sandbox.buildExecutionContext = buildExecutionContext;
                sandbox.strategicInit = strategicInit;
                sandbox.tacticalAnalysis = tacticalAnalysis;
            }
        `);

        runCode(sandbox);
        sandbox.G_Blueprint.initialized = false;
        sandbox.G_Blueprint.enemySeen = false;

        let guardFires = [];
        let guardTurns = [];
        let guardRuns = [];
        let delayWaits = [];
        let delayTurns = [];

        for (let f = 1; f < records.length; f++) {
            const frameEvents = records[f] || [];

            if (meSkillCD > 0) meSkillCD--;
            if (enemySkillCD > 0) enemySkillCD--;
            if (meFireLockTimer > 0) {
                meFireLockTimer--;
                if (meFireLockTimer === 0) meStatus.fireLocked = false;
            }
            if (enemyFireLockTimer > 0) {
                enemyFireLockTimer--;
                if (enemyFireLockTimer === 0) enemyStatus.fireLocked = false;
            }

            for (const ev of frameEvents) {
                const isMe = (ev.objectId === meId || ev.sourceObjectId === meId || ev.targetObjectId === meId || ev.by === meIndex);
                const isEnemy = (ev.objectId === enemyId || ev.sourceObjectId === enemyId || ev.targetObjectId === enemyId || ev.by === enemyIndex);

                if (isMe) {
                    if (ev.action === "go" || ev.event === "move") {
                        mePos = ev.position || ev.to;
                    } else if (ev.action === "turn" || ev.event === "turn") {
                        meDir = getNewDirection(meDir, ev.direction);
                    } else if (ev.action === "applied" && ev.skillType === "teleport") {
                        mePos = ev.to;
                        meStatus.fireLocked = true;
                        meFireLockTimer = 2;
                    }
                } else if (isEnemy) {
                    if (ev.action === "go" || ev.event === "move") {
                        enemyPos = ev.position || ev.to;
                    } else if (ev.action === "turn" || ev.event === "turn") {
                        enemyDir = getNewDirection(enemyDir, ev.direction);
                    } else if (ev.action === "applied" && ev.skillType === "teleport") {
                        enemyPos = ev.to;
                        enemyStatus.fireLocked = true;
                        enemyFireLockTimer = 2;
                    }
                }

                if (ev.type === "bullet") {
                    if (ev.action === "created") {
                        bulletsMap.set(ev.objectId, { position: ev.position, direction: ev.direction || "up", shooterId: ev.tank ? ev.tank.id : null });
                    } else if (ev.action === "go") {
                        let b = bulletsMap.get(ev.objectId);
                        if (b) {
                            b.position = ev.position;
                            if (ev.direction) b.direction = ev.direction;
                        }
                    } else if (ev.action === "crashed") {
                        bulletsMap.delete(ev.objectId);
                    }
                }

                if (ev.type === "star" || ev.event === "star_spawned" || ev.action === "created" && ev.type === "star") {
                    starPos = ev.position || ev.at;
                }
                if (ev.event === "star_collected" || ev.action === "collected") {
                    starPos = null;
                }

                if (ev.action === "cast" && ev.type === "skill") {
                    if (isMe) meSkillCD = COOLDOWNS[ev.skillType];
                    else enemySkillCD = COOLDOWNS[ev.skillType];
                }

                if (ev.action === "applied") {
                    const targetObj = ev.targetObjectId;
                    const stat = targetObj === meId ? meStatus : enemyStatus;
                    if (ev.skillType === "shield") stat.shielded = true;
                    if (ev.skillType === "cloak") stat.cloaked = true;
                    if (ev.skillType === "boost") stat.boosted = true;
                    if (ev.skillType === "overload") stat.overloaded = true;
                    if (ev.skillType === "freeze" || ev.debuffType === "frozen") stat.frozen = true;
                    if (ev.skillType === "stun" || ev.debuffType === "stunned") stat.stunned = true;
                    if (ev.skillType === "poison" || ev.debuffType === "poisoned") stat.poisoned = true;
                }
                if (ev.action === "removed" || ev.action === "expired") {
                    const targetObj = ev.targetObjectId;
                    const stat = targetObj === meId ? meStatus : enemyStatus;
                    if (ev.skillType === "shield") stat.shielded = false;
                    if (ev.skillType === "cloak") stat.cloaked = false;
                    if (ev.skillType === "boost") stat.boosted = false;
                    if (ev.skillType === "overload") stat.overloaded = false;
                    if (ev.skillType === "freeze" || ev.debuffType === "frozen") stat.frozen = false;
                    if (ev.skillType === "stun" || ev.debuffType === "stunned") stat.stunned = false;
                    if (ev.skillType === "poison" || ev.debuffType === "poisoned") stat.poisoned = false;
                }
            }

            let meB = null;
            let enemyB = null;
            for (const [bid, b] of bulletsMap.entries()) {
                const bInfo = { position: b.position.slice(), direction: b.direction };
                if (b.shooterId === meId) meB = bInfo;
                else if (b.shooterId === enemyId) enemyB = bInfo;
            }

            const enemyInGrass = !!(sandbox.G_Blueprint.mapVision && sandbox.G_Blueprint.mapVision.grass[enemyPos[0] + "," + enemyPos[1]]);
            const enemyVisible = !enemyStatus.cloaked && !enemyInGrass;
            let visibleEnemyB = null;
            if (enemyB && sandbox.isLoS && sandbox.isLoS(mePos, enemyB.position, meDir, map)) {
                visibleEnemyB = enemyB;
            }

            const meObj = {
                tank: { id: 230, position: mePos.slice(), direction: meDir, crashed: false },
                stars: 0, bullet: meB,
                skill: { type: meSkillType, cooldownFrames: COOLDOWNS[meSkillType], remainingCooldownFrames: meSkillCD, activeRemainingFrames: 0, activeType: null },
                status: Object.assign({}, meStatus)
            };

            const enemyObj = {
                tank: enemyVisible ? { id: 1414, position: enemyPos.slice(), direction: enemyDir, crashed: false } : null,
                bullet: visibleEnemyB, stars: 0,
                skill: { type: enemySkillType, cooldownFrames: COOLDOWNS[enemySkillType], remainingCooldownFrames: enemySkillCD, activeRemainingFrames: 0, activeType: null },
                status: Object.assign({}, enemyStatus)
            };

            const gameObj = { map: map, star: starPos ? starPos.slice() : null, frames: f };

            let spokenText = "";
            const meSandboxObj = Object.assign({}, meObj, {
                go: function() {}, turn: function() {}, fire: function() {}, teleport: function() {},
                speak: function(text) { spokenText = text; }
            });

            try {
                sandbox.G_History.frame = f;
                if (!sandbox.G_Blueprint.initialized || (enemyObj.tank && !sandbox.G_Blueprint.enemySeen)) {
                    sandbox.strategicInit(enemyObj, gameObj.map);
                }
                const ctx = sandbox.buildExecutionContext(meSandboxObj, enemyObj, gameObj);
                sandbox.onIdle(meSandboxObj, enemyObj, gameObj);

                if (spokenText) {
                    if (spokenText.includes("Guard Fire")) guardFires.push(f);
                    if (spokenText.includes("Guard Turn")) guardTurns.push(f);
                    if (spokenText.includes("Guard Run")) guardRuns.push(f);
                    if (spokenText.includes("Delay Wait")) delayWaits.push(f);
                    if (spokenText.includes("Delay Turn")) delayTurns.push(f);
                }
            } catch (err) {}
        }

        const isTriggered = guardFires.length > 0 || guardTurns.length > 0 || guardRuns.length > 0 || delayWaits.length > 0 || delayTurns.length > 0;
        if (isTriggered) {
            console.log(`\n🎉 [对局 ${match.matchNum}] (${result.toUpperCase()}) ${urlId} (对手: ${opponent}) 触发情况：`);
            if (guardFires.length > 0) { console.log(`   - [Guard Fire] 触发帧: ${guardFires.join(', ')}`); totalGuardFires += guardFires.length; }
            if (guardTurns.length > 0) { console.log(`   - [Guard Turn] 触发帧: ${guardTurns.join(', ')}`); totalGuardTurns += guardTurns.length; }
            if (guardRuns.length > 0) { console.log(`   - [Guard Run] 触发帧: ${guardRuns.join(', ')}`); totalGuardRuns += guardRuns.length; }
            if (delayWaits.length > 0) { console.log(`   - [Delay Wait] 触发帧: ${delayWaits.join(', ')}`); totalDelayWaits += delayWaits.length; }
            if (delayTurns.length > 0) { console.log(`   - [Delay Turn] 触发帧: ${delayTurns.join(', ')}`); totalDelayTurns += delayTurns.length; }
        } else {
            console.log(`➖ [对局 ${match.matchNum}] (${result.toUpperCase()}) ${urlId} (对手: ${opponent}) 未触发。`);
        }
    }

    console.log(`\n=== 守星与吃星延迟统计汇总 ===`);
    console.log(`总分析对局数: ${matches.length}`);
    console.log(`- Guard Fire (守星开火) 总次数: ${totalGuardFires}`);
    console.log(`- Guard Turn (守星转向) 总次数: ${totalGuardTurns}`);
    console.log(`- Guard Run  (守星撤退) 总次数: ${totalGuardRuns}`);
    console.log(`- Delay Wait (吃星延迟等待) 总次数: ${totalDelayWaits}`);
    console.log(`- Delay Turn (吃星延迟转向) 总次数: ${totalDelayTurns}`);
}

main();
