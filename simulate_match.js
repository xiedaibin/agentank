const fs = require('fs');
const path = require('path');
const { getToken } = require('./config');

const matchId = process.argv[2];
if (!matchId) {
    console.log("Usage: node simulate_match.js <MatchID>");
    console.log("Example: node simulate_match.js mat_0tnLfXhzpKOD6AGBZ");
    process.exit(1);
}

const token = getToken();

function getNewDirection(currentDir, turn) {
    const dirs = ["up", "right", "down", "left"];
    const idx = dirs.indexOf(currentDir);
    if (idx === -1) return currentDir;
    if (turn === "left") return dirs[(idx - 1 + 4) % 4];
    if (turn === "right") return dirs[(idx + 1) % 4];
    return currentDir;
}

function getDist(a, b) {
    if (!a || !b) return 999;
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function directionTo(a, b) {
    if (b[0] > a[0]) return "right";
    if (b[0] < a[0]) return "left";
    if (b[1] > a[1]) return "down";
    return "up";
}

async function fetchMatchData(matchId, token) {
    const scratchDir = path.join(__dirname, 'scratch');
    if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
    }
    const rawPath = path.join(scratchDir, `${matchId}_raw.json`);
    const summaryPath = path.join(scratchDir, `${matchId}_summary.json`);

    if (!fs.existsSync(rawPath) || !fs.existsSync(summaryPath)) {
        console.log(`[Simulator] Downloading match data for ${matchId}...`);
        if (!token) {
            console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
            process.exit(1);
        }

        // Fetch summary
        const summaryRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!summaryRes.ok) {
            console.error(`Error: Failed to fetch summary (HTTP ${summaryRes.status})`);
            process.exit(1);
        }
        const summaryJson = await summaryRes.json();
        fs.writeFileSync(summaryPath, JSON.stringify(summaryJson, null, 2));

        // Fetch raw
        const rawRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=raw`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!rawRes.ok) {
            console.error(`Error: Failed to fetch raw replay (HTTP ${rawRes.status})`);
            process.exit(1);
        }
        const rawJson = await rawRes.json();
        fs.writeFileSync(rawPath, JSON.stringify(rawJson, null, 2));
        console.log(`[Simulator] Downloaded and saved to scratch/`);
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    return { summary, raw };
}

const COOLDOWNS = {
    shield: 32,
    freeze: 34,
    stun: 31,
    overload: 32,
    cloak: 32,
    poison: 34,
    teleport: 40,
    boost: 31
};

async function main() {
    const { summary, raw } = await fetchMatchData(matchId, token);
    const records = raw.replayData.replay.records || [];
    const map = raw.replayData.map.map;

    // Dynamically identify XDB and opponent
    const participants = summary.participants;
    let meName = "XDB";
    let enemyName = "Opponent";
    let meId = null;
    let enemyId = null;

    // We identify XDB as defender or challenger
    if (participants.defender && participants.defender.tankName === "XDB") {
        meId = raw.replayData.replay.meta.players[1].tank.id;
        meName = "XDB";
        enemyId = raw.replayData.replay.meta.players[0].tank.id;
        enemyName = participants.challenger.tankName;
    } else {
        meId = raw.replayData.replay.meta.players[0].tank.id;
        meName = "XDB";
        enemyId = raw.replayData.replay.meta.players[1].tank.id;
        enemyName = participants.defender.tankName;
    }

    console.log(`\n=================== Simulation Config ===================`);
    console.log(`  My Tank (XDB) ID : ${meId}`);
    console.log(`  Enemy (${enemyName}) ID : ${enemyId}`);
    console.log(`=========================================================\n`);

    // Extract starting positions & directions
    let p0 = raw.replayData.replay.meta.players[0];
    let p1 = raw.replayData.replay.meta.players[1];
    let meStartPos = p0.tank.id === meId ? p0.tank.position : p1.tank.position;
    let meStartDir = p0.tank.id === meId ? p0.tank.direction : p1.tank.direction;
    let enemyStartPos = p0.tank.id === meId ? p1.tank.position : p0.tank.position;
    let enemyStartDir = p0.tank.id === meId ? p1.tank.direction : p0.tank.direction;

    // Current states
    let mePos = meStartPos.slice();
    let meDir = meStartDir;
    let enemyPos = enemyStartPos.slice();
    let enemyDir = enemyStartDir;

    let starPos = null;
    let bulletsMap = new Map(); // bulletId -> { position, direction, shooterId }

    // Cooldown state
    let meSkillType = (participants.defender && participants.defender.tankName === "XDB") ? "teleport" : "teleport"; // XDB is teleport
    // Find enemy skill
    let enemySkillType = "cloak"; // default fallback
    // We can check if it exists in participants
    if (participants.challenger && participants.challenger.tankName !== "XDB") {
        // Find if skill type is recorded in summary, else auto-detect or default to cloak
        // Let's assume cloak or freeze based on summary logs, but let's check events in Frame 0/1 or raw.
    }
    // We can scan raw records for cast events by enemyId to dynamically determine enemySkillType
    for (const frameEvents of records) {
        for (const ev of frameEvents) {
            if (ev.sourceObjectId === enemyId && ev.action === "cast" && ev.skillType) {
                enemySkillType = ev.skillType;
                break;
            }
        }
    }

    let meSkillCD = 0;
    let enemySkillCD = 0;

    // Statuses
    let meStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
    let enemyStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };

    let meFireLockTimer = 0;
    let enemyFireLockTimer = 0;

    // Load local code
    const newTankCode = fs.readFileSync(path.join(__dirname, 'new_tank.js'), 'utf8');

    const sandbox = {
        G_Blueprint: null,
        G_History: null,
        CONFIG: null,
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
            sandbox.tacticalAnalysis = tacticalAnalysis;
            sandbox.getNextStep = getNextStep;
            sandbox.isSafe = isSafe;
            sandbox.isSafeForStarWalking = isSafeForStarWalking;
            sandbox.canShoot = canShoot;
            sandbox.isLoS = isLoS;
            sandbox.directionTo = directionTo;
            sandbox.buildExecutionContext = buildExecutionContext;
            sandbox.strategicInit = strategicInit;
        }
    `);

    runCode(sandbox);

    // Initialize Blueprint in Frame 1
    sandbox.G_Blueprint.initialized = false;
    sandbox.G_Blueprint.enemySeen = false;

    // Step through each frame record
    for (let f = 1; f < records.length; f++) {
        const frameEvents = records[f] || [];

        // Decrement CD timers
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

        let meActualActionStr = "stay still";
        let enemyActualActionStr = "stay still";

        // Parse events for this frame to update simulator state
        for (const ev of frameEvents) {
            const isMe = (ev.objectId === meId || ev.sourceObjectId === meId || ev.targetObjectId === meId || ev.by === 1);
            const isEnemy = (ev.objectId === enemyId || ev.sourceObjectId === enemyId || ev.targetObjectId === enemyId || ev.by === 0);

            // 1. Movement and turning
            if (isMe) {
                if (ev.action === "go" || ev.event === "move") {
                    mePos = ev.position || ev.to;
                    meActualActionStr = `move to [${mePos}]`;
                } else if (ev.action === "turn" || ev.event === "turn") {
                    meDir = getNewDirection(meDir, ev.direction);
                    meActualActionStr = `turn ${ev.direction} (now ${meDir})`;
                } else if (ev.action === "applied" && ev.skillType === "teleport") {
                    mePos = ev.to;
                    meActualActionStr = `teleported to [${mePos}]`;
                    meStatus.fireLocked = true;
                    meFireLockTimer = 2; // firelocked for 2 frames
                } else if (ev.event === "fire" || ev.action === "fire" || ev.action === "created" && ev.type === "bullet") {
                    meActualActionStr = `FIRE direction ${ev.direction || meDir}`;
                } else if (ev.event === "crashed") {
                    meActualActionStr = `CRASHED`;
                }
            } else if (isEnemy) {
                if (ev.action === "go" || ev.event === "move") {
                    enemyPos = ev.position || ev.to;
                    enemyActualActionStr = `move to [${enemyPos}]`;
                } else if (ev.action === "turn" || ev.event === "turn") {
                    enemyDir = getNewDirection(enemyDir, ev.direction);
                    enemyActualActionStr = `turn ${ev.direction} (now ${enemyDir})`;
                } else if (ev.action === "applied" && ev.skillType === "teleport") {
                    enemyPos = ev.to;
                    enemyActualActionStr = `teleported to [${enemyPos}]`;
                    enemyStatus.fireLocked = true;
                    enemyFireLockTimer = 2;
                } else if (ev.event === "fire" || ev.action === "fire" || ev.action === "created" && ev.type === "bullet") {
                    enemyActualActionStr = `FIRE direction ${ev.direction || enemyDir}`;
                } else if (ev.event === "crashed") {
                    enemyActualActionStr = `CRASHED`;
                }
            }

            // 2. Bullets
            if (ev.type === "bullet") {
                if (ev.action === "created") {
                    bulletsMap.set(ev.objectId, {
                        position: ev.position,
                        direction: ev.direction || "up",
                        shooterId: ev.tank ? ev.tank.id : null
                    });
                } else if (ev.action === "go") {
                    let b = bulletsMap.get(ev.objectId);
                    if (!b) {
                        b = { position: ev.position, direction: ev.direction, shooterId: ev.tank ? ev.tank.id : null };
                        bulletsMap.set(ev.objectId, b);
                    }
                    b.position = ev.position;
                    if (ev.direction) b.direction = ev.direction;
                    if (ev.tank && ev.tank.id) b.shooterId = ev.tank.id;
                } else if (ev.action === "crashed") {
                    bulletsMap.delete(ev.objectId);
                }
            }

            // 3. Stars
            if (ev.type === "star" || ev.event === "star_spawned" || ev.action === "created" && ev.type === "star") {
                starPos = ev.position || ev.at;
            }
            if (ev.event === "star_collected" || ev.action === "collected") {
                starPos = null;
            }

            // 4. Cooldowns
            if (ev.action === "cast" && ev.type === "skill") {
                const type = ev.skillType;
                const cd = COOLDOWNS[type] || 32;
                if (isMe) meSkillCD = cd;
                else enemySkillCD = cd;
            }

            // 5. Status Debuffs
            if (ev.action === "applied") {
                const sType = ev.skillType;
                const dType = ev.debuffType;
                const targetObj = ev.targetObjectId;

                const updateStatus = (status, key, val) => {
                    status[key] = val;
                };

                const stat = targetObj === meId ? meStatus : enemyStatus;
                if (sType === "shield") updateStatus(stat, "shielded", true);
                if (sType === "cloak") updateStatus(stat, "cloaked", true);
                if (sType === "boost") updateStatus(stat, "boosted", true);
                if (sType === "overload") updateStatus(stat, "overloaded", true);
                if (sType === "freeze" || dType === "frozen") updateStatus(stat, "frozen", true);
                if (sType === "stun" || dType === "stunned") updateStatus(stat, "stunned", true);
                if (sType === "poison" || dType === "poisoned") updateStatus(stat, "poisoned", true);
            }
            if (ev.action === "removed") {
                const sType = ev.skillType;
                const dType = ev.debuffType;
                const targetObj = ev.targetObjectId;

                const stat = targetObj === meId ? meStatus : enemyStatus;
                if (sType === "shield") stat.shielded = false;
                if (sType === "cloak") stat.cloaked = false;
                if (sType === "boost") stat.boosted = false;
                if (sType === "overload") stat.overloaded = false;
                if (sType === "freeze" || dType === "frozen") stat.frozen = false;
                if (sType === "stun" || dType === "stunned") stat.stunned = false;
                if (sType === "poison" || dType === "poisoned") stat.poisoned = false;
            }
        }

        // Determine active bullets
        let meB = null;
        let enemyB = null;
        for (const [bid, b] of bulletsMap.entries()) {
            const bInfo = { position: b.position.slice(), direction: b.direction };
            if (b.shooterId === meId) meB = bInfo;
            else if (b.shooterId === enemyId) enemyB = bInfo;
        }

        // Enemy visibility rules
        const enemyInGrass = !!(sandbox.G_Blueprint.mapVision && sandbox.G_Blueprint.mapVision.grass[enemyPos[0] + "," + enemyPos[1]]);
        const enemyVisible = !enemyStatus.cloaked && !enemyInGrass;

        // Enemy bullet visibility check
        let visibleEnemyB = null;
        if (enemyB) {
            // Check if bullet lies in line of sight from mePos in meDir
            const inLine = sandbox.isLoS && sandbox.isLoS(mePos, enemyB.position, meDir, map);
            if (inLine) visibleEnemyB = enemyB;
        }

        // Construct sandbox data objects
        const me = {
            tank: { id: 230, position: mePos.slice(), direction: meDir, crashed: false },
            stars: f < 17 ? 0 : 1, // approximate star count or dynamically track
            bullet: meB,
            skill: {
                type: meSkillType,
                cooldownFrames: COOLDOWNS[meSkillType],
                remainingCooldownFrames: meSkillCD,
                activeRemainingFrames: 0,
                activeType: null
            },
            status: Object.assign({}, meStatus)
        };

        const enemy = {
            tank: enemyVisible ? { id: 1414, position: enemyPos.slice(), direction: enemyDir, crashed: false } : null,
            bullet: visibleEnemyB,
            stars: f < 17 ? 0 : 0,
            skill: {
                type: enemySkillType,
                cooldownFrames: COOLDOWNS[enemySkillType],
                remainingCooldownFrames: enemySkillCD,
                activeRemainingFrames: 0,
                activeType: null
            },
            status: Object.assign({}, enemyStatus)
        };

        const game = {
            map: map,
            star: starPos ? starPos.slice() : null,
            frames: f
        };

        console.log(`--------------------------------------------------------------------------------`);
        console.log(`Frame ${f} | Star: ${JSON.stringify(starPos)} | Map: ${raw.replayData.map.id}`);
        console.log(`[State] XDB   : Pos=[${mePos}] Dir=${meDir.padEnd(5)} | CD=${meSkillCD} | Status=[${Object.keys(meStatus).filter(k => meStatus[k]).join(', ') || 'Normal'}]`);
        console.log(`        ${enemyName.padEnd(5)} : Pos=[${enemyPos}] Dir=${enemyDir.padEnd(5)} | CD=${enemySkillCD} | Status=[${Object.keys(enemyStatus).filter(k => enemyStatus[k]).join(', ') || 'Normal'}] (Visible: ${enemyVisible})`);
        
        console.log(`[Replay Actions]`);
        console.log(`  ⚔️ ${enemyName.padEnd(5)}: ${enemyActualActionStr}`);
        console.log(`  🛡️ XDB   : ${meActualActionStr}`);

        // Capture local code queued actions
        let queuedAction = "stay still";
        const meSandboxObj = Object.assign({}, me, {
            go: function(steps) { queuedAction = `go(${steps || 1})`; },
            turn: function(dir) { queuedAction = `turn("${dir}")`; },
            fire: function() { queuedAction = `fire()`; },
            speak: function(text) { queuedAction = `${queuedAction === "stay still" ? "" : queuedAction + " | "}speak("${text}")`; },
            teleport: function(x, y) { queuedAction = `teleport(${x}, ${y})`; }
        });

        // Run local tank onIdle
        try {
            sandbox.G_History.frame = f;
            if (!sandbox.G_Blueprint.initialized || (enemy.tank && !sandbox.G_Blueprint.enemySeen)) {
                sandbox.strategicInit(enemy, game.map);
            }
            const ctx = sandbox.buildExecutionContext(meSandboxObj, enemy, game);
            const bestAction = sandbox.tacticalAnalysis(ctx);
            console.log(`[Local Simulation Evaluation]`);
            console.log(`  Chosen Target: ${JSON.stringify(bestAction)}`);
            if (bestAction && bestAction.action === "move") {
                const nextStep = sandbox.getNextStep(ctx.myPos, bestAction.target, ctx);
                if (nextStep) {
                    const d = sandbox.directionTo(ctx.myPos, nextStep);
                    console.log(`  Path NextStep: [${nextStep}] -> Need Turn/Move Dir: ${d}`);
                }
            }

            sandbox.onIdle(meSandboxObj, enemy, game);
            console.log(`  🤖 Local Code Action: ${queuedAction}`);

            // Divergence Detection
            // Clean up both action strings to compare them roughly
            const clean = (str) => str.toLowerCase().replace(/\s+/g, '');
            const actionMatches = clean(meActualActionStr).includes(clean(queuedAction.split('|')[0])) || 
                                  (clean(meActualActionStr) === "staystill" && clean(queuedAction) === "staystill");

            if (!actionMatches) {
                console.log(`  ⚠️ [Diverged] Local Code Action differs from Replay!`);
                console.log(`     -> Replay Action: ${meActualActionStr}`);
                console.log(`     -> Local Code   : ${queuedAction}`);
            }
        } catch(e) {
            console.error("Error executing local onIdle:", e);
        }
    }
    console.log(`================================================================================`);
}

main();
