const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'mat_JcNDCYNpv2rAIZXQo_raw.json');
const summaryPath = path.join(__dirname, 'mat_JcNDCYNpv2rAIZXQo_summary.json');

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

const records = raw.replayData.replay.records || [];
const map = raw.replayData.map.map;

const newTankCode = fs.readFileSync(path.join(__dirname, '..', 'new_tank.js'), 'utf8');

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
        sandbox.buildExecutionContext = buildExecutionContext;
        sandbox.strategicInit = strategicInit;
        sandbox.findPreAimDir = findPreAimDir;
        sandbox.evalPreAim = evalPreAim;
    }
`);

runCode(sandbox);

sandbox.G_Blueprint.initialized = false;
sandbox.G_Blueprint.enemySeen = false;

// Dynamically identify IDs
const participants = summary.participants;
let meId = null;
let enemyId = null;
let meName = "XDB";
let enemyName = "Opponent";

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

let mePos = raw.replayData.replay.meta.players[meIndex].tank.position.slice();
let meDir = raw.replayData.replay.meta.players[meIndex].tank.direction;
let enemyPos = raw.replayData.replay.meta.players[enemyIndex].tank.position.slice();
let enemyDir = raw.replayData.replay.meta.players[enemyIndex].tank.direction;

let starPos = null;
let bulletsMap = new Map();

function getNewDirection(currentDir, turn) {
    const dirs = ["up", "right", "down", "left"];
    const idx = dirs.indexOf(currentDir);
    if (idx === -1) return currentDir;
    if (turn === "left") return dirs[(idx - 1 + 4) % 4];
    if (turn === "right") return dirs[(idx + 1) % 4];
    return currentDir;
}

for (let f = 1; f < records.length; f++) {
    const frameEvents = records[f] || [];
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
            }
        } else if (isEnemy) {
            if (ev.action === "go" || ev.event === "move") {
                enemyPos = ev.position || ev.to;
            } else if (ev.action === "turn" || ev.event === "turn") {
                enemyDir = getNewDirection(enemyDir, ev.direction);
            } else if (ev.action === "applied" && ev.skillType === "teleport") {
                enemyPos = ev.to;
            }
        }

        if (ev.type === "bullet") {
            if (ev.action === "created") {
                bulletsMap.set(ev.objectId, { position: ev.position, direction: ev.direction || "up", shooterId: ev.tank ? ev.tank.id : null });
            } else if (ev.action === "go") {
                let b = bulletsMap.get(ev.objectId);
                if (b) {
                    b.position = ev.position;
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
    }

    if (f >= 115 && f <= 122) {
        let meB = null;
        let enemyB = null;
        for (const [bid, b] of bulletsMap.entries()) {
            const bInfo = { position: b.position.slice(), direction: b.direction };
            if (b.shooterId === meId) meB = bInfo;
            else if (b.shooterId === enemyId) enemyB = bInfo;
        }

        const enemyInGrass = !!(sandbox.G_Blueprint.mapVision && sandbox.G_Blueprint.mapVision.grass[enemyPos[0] + "," + enemyPos[1]]);
        const enemyVisible = !enemyInGrass; // simplified

        const me = {
            tank: { id: meId, position: mePos.slice(), direction: meDir, crashed: false },
            stars: 0,
            bullet: meB,
            skill: { type: "teleport", cooldownFrames: 40, remainingCooldownFrames: 0 },
            status: { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false }
        };

        const enemy = {
            tank: enemyVisible ? { id: enemyId, position: enemyPos.slice(), direction: enemyDir, crashed: false } : null,
            bullet: enemyB,
            stars: 0,
            skill: { type: "teleport", cooldownFrames: 40, remainingCooldownFrames: 0 },
            status: { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false }
        };

        const game = {
            map: map,
            star: starPos ? starPos.slice() : null,
            frames: f
        };

        sandbox.G_History.frame = f;
        if (!sandbox.G_Blueprint.initialized || (enemy.tank && !sandbox.G_Blueprint.enemySeen)) {
            sandbox.strategicInit(enemy, game.map);
        }

        const ctx = sandbox.buildExecutionContext(me, enemy, game);

        console.log(`\n--- Frame ${f} ---`);
        console.log(`  XDB Pos: [${ctx.myPos}], Dir: ${ctx.myDir}`);
        console.log(`  Enemy Real Pos: [${enemyPos}], Dir: ${enemyDir}, Visible: ${ctx.enemyVisible}`);
        console.log(`  Ctx EnemyPos (Predicted): [${ctx.enemyPos}], Dir: ${ctx.enemyDir}`);
        console.log(`  enemyInvisibleFrames: ${sandbox.G_History.enemyInvisibleFrames}`);
        console.log(`  isEnemyRecentlyInvisibleInGrass: ${ctx.isEnemyRecentlyInvisibleInGrass}`);
        console.log(`  StarPos: ${JSON.stringify(ctx.starPos)}`);

        // Check findPreAimDir
        if (ctx.shootingEnemyPos && ctx.enemyDir) {
            const preAimDir = sandbox.findPreAimDir(ctx.myPos, ctx.shootingEnemyPos, ctx.enemyDir, ctx.map);
            console.log(`  findPreAimDir returned: ${preAimDir}`);
        } else {
            console.log(`  No shootingEnemyPos or enemyDir`);
        }

        const preAimCandidate = sandbox.evalPreAim(ctx);
        console.log(`  evalPreAim returned: ${JSON.stringify(preAimCandidate)}`);
    }
}
