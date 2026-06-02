const fs = require('fs');
const path = require('path');

const matchId = 'mat_0tnLfXhzpKOD6AGBZ';
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, `${matchId}_raw.json`), 'utf8'));
const records = raw.replayData.replay.records || [];
const map = raw.replayData.map.map;

const newTankCode = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');

const xdbId = "fe548ee8";
const taoqiId = "4427d089";

function getNewDirection(currentDir, turn) {
    const dirs = ["up", "right", "down", "left"];
    const idx = dirs.indexOf(currentDir);
    if (idx === -1) return currentDir;
    if (turn === "left") return dirs[(idx - 1 + 4) % 4];
    if (turn === "right") return dirs[(idx + 1) % 4];
    return currentDir;
}

let xdbPos = [16, 12];
let xdbDir = "down";
let taoqiPos = [2, 2];
let taoqiDir = "up";

let xdbBullet = null;
let taoqiBullet = null;
let starPos = [8, 10]; 

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

for (let f = 1; f < records.length; f++) {
    const frameEvents = records[f] || [];

    let starCollectedThisFrame = false;
    let starSpawnedThisFrame = null;
    let xdbTeleportedThisFrame = null;

    for (const ev of frameEvents) {
        let isXDB = (ev.tank === "XDB" || ev.objectId === xdbId || ev.sourceObjectId === xdbId || ev.by === 1);
        let isTaoqi = (ev.tank === "Taoqi" || ev.objectId === taoqiId || ev.sourceObjectId === taoqiId || ev.by === 0);

        if (isXDB) {
            if (ev.action === "go" || ev.event === "move") {
                xdbPos = ev.position || ev.to;
            } else if (ev.action === "turn" || ev.event === "turn") {
                xdbDir = getNewDirection(xdbDir, ev.direction);
            } else if (ev.action === "applied" && ev.skillType === "teleport") {
                xdbPos = ev.to;
                xdbTeleportedThisFrame = ev.to;
            }
        } else if (isTaoqi) {
            if (ev.action === "go" || ev.event === "move") {
                taoqiPos = ev.position || ev.to;
            } else if (ev.action === "turn" || ev.event === "turn") {
                taoqiDir = getNewDirection(taoqiDir, ev.direction);
            }
        }

        if (ev.type === "star" || ev.event === "star_spawned") {
            starSpawnedThisFrame = ev.position || ev.at;
        }
        if (ev.event === "star_collected" || ev.action === "collected") {
            starCollectedThisFrame = true;
        }
    }

    if (starSpawnedThisFrame) {
        starPos = starSpawnedThisFrame;
    }
    if (starCollectedThisFrame) {
        starPos = null;
    }

    let xdbB = null;
    let taoqiB = null;
    for (const ev of frameEvents) {
        if (ev.type === "bullet") {
            const isXdbBullet = (ev.by === 1);
            const bInfo = {
                position: ev.position,
                direction: ev.direction || "up"
            };
            if (isXdbBullet) xdbB = bInfo;
            else taoqiB = bInfo;
        }
    }

    const me = {
        tank: {
            id: 230,
            position: xdbPos.slice(),
            direction: xdbDir,
            crashed: false
        },
        stars: f < 17 ? 1 : 1,
        bullet: xdbB,
        skill: {
            type: "teleport",
            cooldownFrames: 40,
            remainingCooldownFrames: f === 1 ? 0 : Math.max(0, 40 - (f - 1)),
            activeRemainingFrames: 0,
            activeType: null
        },
        status: {
            shielded: false,
            cloaked: false,
            boosted: false,
            overloaded: false,
            frozen: false,
            stunned: false,
            poisoned: false,
            fireLocked: xdbTeleportedThisFrame ? true : (f > 1 && f < 4),
            actionSpeed: 1,
            canActThisFrame: true
        },
        go: function(steps) { console.log(`    -> Queued Action: go(${steps || 1})`); },
        turn: function(dir) { console.log(`    -> Queued Action: turn("${dir}")`); },
        fire: function() { console.log(`    -> Queued Action: fire()`); },
        speak: function(text) { console.log(`    -> Queued Action: speak("${text}")`); },
        teleport: function(x, y) { console.log(`    -> Queued Action: teleport(${x}, ${y})`); }
    };

    const isTaoqiInGrass = !!(sandbox.G_Blueprint.mapVision && sandbox.G_Blueprint.mapVision.grass[taoqiPos[0] + "," + taoqiPos[1]]);
    const enemyVisible = !isTaoqiInGrass;

    const enemy = {
        tank: enemyVisible ? {
            id: 1414,
            position: taoqiPos.slice(),
            direction: taoqiDir,
            crashed: false
        } : null,
        bullet: taoqiB,
        stars: f < 17 ? 0 : 1,
        skill: {
            type: "cloak",
            cooldownFrames: 32,
            remainingCooldownFrames: 0,
            activeRemainingFrames: 0,
            activeType: null
        },
        status: {
            shielded: false,
            cloaked: false,
            boosted: false,
            overloaded: false,
            frozen: false,
            stunned: false,
            poisoned: false,
            fireLocked: false,
            actionSpeed: 1,
            canActThisFrame: true
        }
    };

    const game = {
        map: map,
        star: starPos ? starPos.slice() : null,
        frames: f
    };

    console.log(`\nFrame ${f}: XDB Pos=[${xdbPos}] Dir=${xdbDir} | Taoqi Pos=[${taoqiPos}] Dir=${taoqiDir} (Visible: ${enemyVisible}) | Star: ${JSON.stringify(starPos)}`);
    
    if (f === 1) {
        sandbox.G_Blueprint.initialized = false;
        sandbox.G_Blueprint.enemySeen = false;
    }

    try {
        sandbox.G_History.frame = f;
        if (!sandbox.G_Blueprint.initialized || (enemy && !sandbox.G_Blueprint.enemySeen)) {
            sandbox.strategicInit(enemy, game.map);
        }
        const ctx = sandbox.buildExecutionContext(me, enemy, game);
        const bestAction = sandbox.tacticalAnalysis(ctx);
        console.log(`    [ANALYSIS] Chosen Action: ${JSON.stringify(bestAction)}`);
        if (bestAction && bestAction.action === "move") {
            const nextStep = sandbox.getNextStep(ctx.myPos, bestAction.target, ctx);
            console.log(`    [PATH] Next Step: ${JSON.stringify(nextStep)}`);
            if (nextStep) {
                const d = sandbox.directionTo(ctx.myPos, nextStep);
                console.log(`    [DIRECTION] directionTo: ${d}, myDir: ${ctx.myDir}`);
            }
        }
        sandbox.onIdle(me, enemy, game);
    } catch(e) {
        console.error("Error executing onIdle:", e);
    }
}
