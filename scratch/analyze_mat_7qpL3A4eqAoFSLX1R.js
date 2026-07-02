const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

const matchId = "mat_7qpL3A4eqAoFSLX1R";
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

const COOLDOWNS = { shield: 25, freeze: 29, stun: 20, overload: 32, cloak: 35, poison: 20, teleport: 40, boost: 26 };

async function fetchMatchData(matchId, token) {
    const scratchDir = __dirname;
    const rawPath = path.join(scratchDir, `${matchId}_raw.json`);
    const summaryPath = path.join(scratchDir, `${matchId}_summary.json`);

    if (!fs.existsSync(rawPath) || !fs.existsSync(summaryPath)) {
        console.log(`Downloading match data for ${matchId}...`);
        const summaryRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const summaryJson = await summaryRes.json();
        fs.writeFileSync(summaryPath, JSON.stringify(summaryJson, null, 2));

        const rawRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=raw`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const rawJson = await rawRes.json();
        fs.writeFileSync(rawPath, JSON.stringify(rawJson, null, 2));
    }
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    return { summary, raw };
}

async function main() {
    const { summary, raw } = await fetchMatchData(matchId, token);
    const records = raw.replayData.replay.records || [];
    const map = raw.replayData.map.map;

    const participants = summary.participants;
    let meName = "XDB";
    let enemyName = "Opponent";
    let meId = null;
    let enemyId = null;

    if (participants.defender && participants.defender.tankName === "XDB") {
        meId = raw.replayData.replay.meta.players[1].tank.id;
        enemyId = raw.replayData.replay.meta.players[0].tank.id;
        enemyName = participants.challenger.tankName;
    } else {
        meId = raw.replayData.replay.meta.players[0].tank.id;
        enemyId = raw.replayData.replay.meta.players[1].tank.id;
        enemyName = participants.defender.tankName;
    }
    const meIndex = raw.replayData.replay.meta.players[0].tank.id === meId ? 0 : 1;
    const enemyIndex = 1 - meIndex;

    let p0 = raw.replayData.replay.meta.players[0];
    let p1 = raw.replayData.replay.meta.players[1];
    let mePos = p0.tank.id === meId ? p0.tank.position : p1.tank.position;
    let meDir = p0.tank.id === meId ? p0.tank.direction : p1.tank.direction;
    let enemyPos = p0.tank.id === meId ? p1.tank.position : p0.tank.position;
    let enemyDir = p0.tank.id === meId ? p1.tank.direction : p0.tank.direction;

    let starPos = null;
    for (const ev of (records[0] || [])) {
        if (ev.type === "star" || ev.event === "star_spawned" || (ev.action === "created" && ev.type === "star")) {
            starPos = ev.position || ev.at;
        }
    }
    let bulletsMap = new Map();

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

    let meSkillCD = 0;
    let enemySkillCD = 0;
    let meStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
    let enemyStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
    let meFireLockTimer = 0;
    let enemyFireLockTimer = 0;

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
            sandbox.tacticalAnalysis = tacticalAnalysis;
            sandbox.getNextStep = getNextStep;
            sandbox.isSafe = isSafe;
            sandbox.isSafeForStarWalking = isSafeForStarWalking;
            sandbox.canShoot = canShoot;
            sandbox.isLoS = isLoS;
            sandbox.directionTo = directionTo;
            sandbox.buildExecutionContext = buildExecutionContext;
            sandbox.strategicInit = strategicInit;
            sandbox.findAssassinSpot = findAssassinSpot;
        }
    `);
    runCode(sandbox);

    sandbox.G_Blueprint.initialized = false;
    sandbox.G_Blueprint.enemySeen = false;

    // We focus on debugging Frame 28 to 33
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
                if (ev.action === "go" || ev.event === "move") mePos = ev.position || ev.to;
                else if (ev.action === "turn" || ev.event === "turn") meDir = getNewDirection(meDir, ev.direction);
                else if (ev.action === "applied" && ev.skillType === "teleport") {
                    mePos = ev.to; meStatus.fireLocked = true; meFireLockTimer = 2;
                }
            } else if (isEnemy) {
                if (ev.action === "go" || ev.event === "move") enemyPos = ev.position || ev.to;
                else if (ev.action === "turn" || ev.event === "turn") enemyDir = getNewDirection(enemyDir, ev.direction);
                else if (ev.action === "applied" && ev.skillType === "teleport") {
                    enemyPos = ev.to; enemyStatus.fireLocked = true; enemyFireLockTimer = 2;
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
                const type = ev.skillType;
                const cd = COOLDOWNS[type] || 32;
                if (isMe) meSkillCD = cd;
                else enemySkillCD = cd;
            }
        }

        const enemyInGrass = !!(sandbox.G_Blueprint.mapVision && sandbox.G_Blueprint.mapVision.grass[enemyPos[0] + "," + enemyPos[1]]);
        const enemyVisible = !enemyStatus.cloaked && !enemyInGrass;

        const meObj = {
            tank: { id: meId, position: mePos.slice(), direction: meDir, crashed: false },
            stars: 0, bullet: null, skill: { type: meSkillType, cooldownFrames: 40, remainingCooldownFrames: meSkillCD },
            status: Object.assign({}, meStatus),
            speak: function(text) { console.log(`    [me.speak] "${text}"`); }
        };

        const enemyObj = {
            tank: enemyVisible ? { id: enemyId, position: enemyPos.slice(), direction: enemyDir, crashed: false } : null,
            bullet: null, stars: 0, skill: { type: enemySkillType, cooldownFrames: 35, remainingCooldownFrames: enemySkillCD },
            status: Object.assign({}, enemyStatus)
        };

        const gameObj = { map: map, star: starPos ? starPos.slice() : null, frames: f };

        if (f >= 27 && f <= 33) {
            console.log(`\n================= Frame ${f} Debug =================`);
            console.log(`XDB Pos=[${mePos}] Dir=${meDir} | CD=${meSkillCD} | fireLocked=${meStatus.fireLocked}`);
            console.log(`Enemy Pos=[${enemyPos}] Dir=${enemyDir} | Visible=${enemyVisible}`);
            
            // Execute buildExecutionContext
            if (!sandbox.G_Blueprint.initialized || (enemyObj.tank && !sandbox.G_Blueprint.enemySeen)) {
                sandbox.strategicInit(enemyObj, gameObj.map);
            }
            const ctx = sandbox.buildExecutionContext(meObj, enemyObj, gameObj);
            console.log(`  推演 [ctx.enemyPos]: [${ctx.enemyPos}] | [ctx.enemyDir]: ${ctx.enemyDir}`);
            
            const spot = sandbox.findAssassinSpot(ctx);
            console.log(`  刺杀落点 [spot]: ${spot ? JSON.stringify(spot) : 'null'}`);
            if (spot) {
                const fireDir = sandbox.directionTo(spot, ctx.enemyPos);
                console.log(`  射击方向 [fireDir]: ${fireDir} | 当前我方方向: ${ctx.myDir}`);
            }

            const bestAction = sandbox.tacticalAnalysis(ctx);
            console.log(`  决定的动作 [bestAction]: ${JSON.stringify(bestAction)}`);
        }

        // Keep sandbox G_History synced
        try {
            sandbox.G_History.frame = f;
            if (!sandbox.G_Blueprint.initialized || (enemyObj.tank && !sandbox.G_Blueprint.enemySeen)) {
                sandbox.strategicInit(enemyObj, gameObj.map);
            }
            const mockMe = Object.assign({}, meObj, {
                go: function() {}, turn: function() {}, fire: function() {}, speak: function() {}, teleport: function() {}
            });
            sandbox.onIdle(mockMe, enemyObj, gameObj);
        } catch(e) {}
    }
}

main();
