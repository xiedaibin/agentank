const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'sim_res.json'), 'utf8'));
const records = raw.replayData.replay.records || [];
const map = raw.replayData.map.map;

const meId = raw.replayData.replay.meta.players[0].tank.id;
const enemyId = raw.replayData.replay.meta.players[1].tank.id;

console.log("XDB ID:", meId, "Enemy ID:", enemyId);

let mePos = raw.replayData.replay.meta.players[0].tank.position.slice();
let meDir = raw.replayData.replay.meta.players[0].tank.direction;
let enemyPos = raw.replayData.replay.meta.players[1].tank.position.slice();
let enemyDir = raw.replayData.replay.meta.players[1].tank.direction;
let starPos = null;
let bulletsMap = new Map();

// Load local code
const newTankCode = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');
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

sandbox.G_Blueprint.initialized = false;
sandbox.G_Blueprint.enemySeen = false;

// COOLDOWNS
const COOLDOWNS = { teleport: 40, cloak: 32 };
let meSkillCD = 0;
let enemySkillCD = 0;

let meStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
let enemyStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };

let meFireLockTimer = 0;
let enemyFireLockTimer = 0;

for (let f = 1; f <= 40; f++) {
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

    // Process events to update simulator positions
    for (const ev of frameEvents) {
        const isMe = (ev.objectId === meId || ev.sourceObjectId === meId || ev.targetObjectId === meId || ev.by === 0);
        const isEnemy = (ev.objectId === enemyId || ev.sourceObjectId === enemyId || ev.targetObjectId === enemyId || ev.by === 1);

        if (isMe) {
            if (ev.action === "go" || ev.event === "move" || ev.type === "tank" && ev.action === "go") {
                mePos = ev.position || ev.to;
            } else if (ev.action === "turn" || ev.event === "turn" || ev.type === "tank" && ev.action === "turn") {
                // simple turn
                if (ev.direction) {
                    if (ev.direction === "left") {
                        meDir = { up: "left", left: "down", down: "right", right: "up" }[meDir];
                    } else {
                        meDir = { up: "right", right: "down", down: "left", left: "up" }[meDir];
                    }
                }
            } else if (ev.action === "applied" && ev.skillType === "teleport") {
                mePos = ev.to;
                meStatus.fireLocked = true;
                meFireLockTimer = 2;
            }
        } else if (isEnemy) {
            if (ev.action === "go" || ev.event === "move" || ev.type === "tank" && ev.action === "go") {
                enemyPos = ev.position || ev.to;
            } else if (ev.action === "turn" || ev.event === "turn" || ev.type === "tank" && ev.action === "turn") {
                if (ev.direction) {
                    if (ev.direction === "left") {
                        enemyDir = { up: "left", left: "down", down: "right", right: "up" }[enemyDir];
                    } else {
                        enemyDir = { up: "right", right: "down", down: "left", left: "up" }[enemyDir];
                    }
                }
            } else if (ev.action === "applied" && ev.skillType === "teleport") {
                enemyPos = ev.to;
                enemyStatus.fireLocked = true;
                enemyFireLockTimer = 2;
            }
        }

        if (ev.type === "bullet") {
            if (ev.action === "created") {
                bulletsMap.set(ev.objectId, { position: ev.position, direction: ev.direction, shooterId: ev.tank ? ev.tank.id : null });
            } else if (ev.action === "go") {
                let b = bulletsMap.get(ev.objectId);
                if (b) b.position = ev.position;
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
            if (isMe) meSkillCD = COOLDOWNS[ev.skillType] || 40;
            else enemySkillCD = COOLDOWNS[ev.skillType] || 32;
        }
    }

    let meB = null;
    let enemyB = null;
    for (const [bid, b] of bulletsMap.entries()) {
        if (b.shooterId === meId) meB = b;
        else enemyB = b;
    }

    const enemyInGrass = !!(sandbox.G_Blueprint.mapVision && sandbox.G_Blueprint.mapVision.grass[enemyPos[0] + "," + enemyPos[1]]);
    const enemyVisible = !enemyStatus.cloaked && !enemyInGrass;

    const meObj = {
        tank: { id: meId, position: mePos.slice(), direction: meDir, crashed: false },
        stars: 0,
        bullet: meB,
        skill: { type: "teleport", cooldownFrames: 40, remainingCooldownFrames: meSkillCD },
        status: Object.assign({}, meStatus)
    };

    const enemyObj = {
        tank: enemyVisible ? { id: enemyId, position: enemyPos.slice(), direction: enemyDir, crashed: false } : null,
        bullet: enemyB,
        stars: 0,
        skill: { type: "cloak", cooldownFrames: 32, remainingCooldownFrames: enemySkillCD },
        status: Object.assign({}, enemyStatus)
    };

    const gameObj = {
        map: map,
        star: starPos ? starPos.slice() : null,
        frames: f
    };

    try {
        sandbox.G_History.frame = f;
        if (!sandbox.G_Blueprint.initialized || (enemyObj.tank && !sandbox.G_Blueprint.enemySeen)) {
            sandbox.strategicInit(enemyObj, gameObj.map);
        }
        const ctx = sandbox.buildExecutionContext(meObj, enemyObj, gameObj);
        console.log(`\nFrame ${f} simulator state:`);
        console.log(`  XDB: Pos=[${mePos}] Dir=${meDir} | Enemy: Pos=[${enemyPos}] Dir=${enemyDir} Visible=${enemyVisible}`);
        console.log(`  Star: ${JSON.stringify(starPos)} | me.bullet: ${meB ? "Active" : "None"}`);
        console.log(`  G_History.startShotsFired: ${sandbox.G_History.startShotsFired || 0}`);
        
        const bestAction = sandbox.tacticalAnalysis(ctx);
        console.log(`  🤖 Chosen Action: ${JSON.stringify(bestAction)}`);
    } catch (e) {
        console.error(e);
    }
}
