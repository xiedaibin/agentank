const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

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

async function main() {
    const token = getToken();
    const matchId = "mat_HR1tCuOe5bQI4VZb0";
    
    // Load raw match json
    const rawPath = path.join(__dirname, `${matchId}_raw.json`);
    const summaryPath = path.join(__dirname, `${matchId}_summary.json`);
    
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    
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

    // Load local code
    const newTankCode = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');

    const sandbox = {
        G_Blueprint: null, G_History: null, CONFIG: null,
        print: function(...args) {
            console.log("    [PRINT]", args.join(" "));
        },
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
            sandbox.isSafe = isSafe;
            sandbox.isSafeForStarWalking = isSafeForStarWalking;
            sandbox.isSafeForStarTeleport = isSafeForStarTeleport;
            sandbox.isOnEnemyGunLine = isOnEnemyGunLine;
            sandbox.getDist = getDist;
        }
    `);

    runCode(sandbox);
    sandbox.G_Blueprint.initialized = false;
    sandbox.G_Blueprint.enemySeen = false;

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

        // Just mock sandbox API
        const meSandboxObj = Object.assign({}, meObj, {
            go: function() { console.log(`    [DECISION] Go`); },
            turn: function(dir) { console.log(`    [DECISION] Turn ${dir}`); },
            fire: function() { console.log(`    [DECISION] Fire`); },
            teleport: function(pos) { console.log(`    [DECISION] Teleport to [${pos}]`); },
            speak: function(text) { console.log(`    [SPEAK] ${text}`); }
        });

        // Print debug info for target frames
        if (f >= 40 && f <= 46) {
            console.log(`\n=================== FRAME ${f} ===================`);
            console.log(`Star: ${JSON.stringify(starPos)}`);
            console.log(`XDB   : Pos=[${mePos}] Dir=${meDir} CD=${meSkillCD} Status=${JSON.stringify(meStatus)}`);
            console.log(`Enemy : Pos=[${enemyPos}] Dir=${enemyDir} CD=${enemySkillCD} Status=${JSON.stringify(enemyStatus)}`);
            
            try {
                sandbox.G_History.frame = f;
                if (!sandbox.G_Blueprint.initialized || (enemyObj.tank && !sandbox.G_Blueprint.enemySeen)) {
                    sandbox.strategicInit(enemyObj, gameObj.map);
                }
                const ctx = sandbox.buildExecutionContext(meSandboxObj, enemyObj, gameObj);
                
                // Inspect specific values
                if (starPos) {
                    console.log(`  isSafe(star, ctx):`, sandbox.isSafe(starPos, ctx, true));
                    console.log(`  isSafeForStarWalking(star, ctx):`, sandbox.isSafeForStarWalking(starPos, ctx));
                    console.log(`  isOnEnemyGunLine(starPos):`, sandbox.isOnEnemyGunLine(starPos, ctx, true));
                }
                console.log(`  isOnEnemyGunLine(myPos):`, sandbox.isOnEnemyGunLine(mePos, ctx, true));
                console.log(`  getDist(me, enemy):`, sandbox.getDist(mePos, enemyPos));

                const bestAction = sandbox.tacticalAnalysis(ctx);
                console.log(`  Chosen Action by Tactical Analysis:`, JSON.stringify(bestAction));
            } catch (err) {
                console.error("  Error in frame evaluation:", err);
            }
        }

        try {
            sandbox.G_History.frame = f;
            if (!sandbox.G_Blueprint.initialized || (enemyObj.tank && !sandbox.G_Blueprint.enemySeen)) {
                sandbox.strategicInit(enemyObj, gameObj.map);
            }
            sandbox.onIdle(meSandboxObj, enemyObj, gameObj);
        } catch (err) {}
    }
}

main();
