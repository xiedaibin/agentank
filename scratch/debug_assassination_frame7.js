const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

const matchId = "mat_5Pfjfa6aqfK0buPyE";
const token = getToken();

// Load raw data
async function fetchMatchData() {
    const rawPath = path.join(__dirname, `${matchId}_raw.json`);
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    return raw;
}

const newTankCode = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');

const sandbox = {
    G_Blueprint: null, G_History: null, CONFIG: null,
    print: console.log
};
const runCode = new Function('sandbox', `
    with (sandbox) {
        ${newTankCode}
        sandbox.findAssassinSpot = findAssassinSpot;
        sandbox.buildExecutionContext = buildExecutionContext;
        sandbox.strategicInit = strategicInit;
        sandbox.getAssassinOffsets = getAssassinOffsets;
        sandbox.addPos = addPos;
        sandbox.isPassable = isPassable;
        sandbox.isSafe = isSafe;
        sandbox.canShoot = canShoot;
        sandbox.isSafeForStarTeleport = isSafeForStarTeleport;
        sandbox.directionTo = directionTo;
        sandbox.delta = delta;
    }
`);
runCode(sandbox);

async function main() {
    const raw = await fetchMatchData();
    const map = raw.replayData.map.map;
    
    // Construct exact Frame 7 XDB state from Simulator logs
    // XDB Pos=[2,1] Dir=right, CD=0
    // Agro Pos=[5,7] Dir=right (Visible = false)
    
    const meObj = {
        tank: { id: "d7d94957", position: [2,1], direction: "right", crashed: false },
        stars: 0, bullet: null, skill: { type: "teleport", cooldownFrames: 40, remainingCooldownFrames: 0 },
        status: { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false },
        speak: console.log
    };

    const enemyObj = {
        tank: null, // invisible
        bullet: null, stars: 0, skill: { type: "cloak", cooldownFrames: 35, remainingCooldownFrames: 34 },
        status: { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false }
    };

    // Star was at [6,7]
    const gameObj = { map: map, star: [6,7], frames: 7 };

    // Sync history
    sandbox.G_History.frame = 7;
    sandbox.G_History.lastEnemyPos = [5,7]; // Agro at 5,7
    sandbox.G_History.lastEnemyDir = "right";
    sandbox.G_History.lastEnemySeenFrame = 1; // Agro teleported in frame 1
    sandbox.G_History.enemyInvisibleFrames = 7 - 1; // 6 frames invisible
    sandbox.G_History.isAmbushStreamDetected = true;

    sandbox.strategicInit(enemyObj, map);
    const ctx = sandbox.buildExecutionContext(meObj, enemyObj, gameObj);

    console.log(`Context details:`);
    console.log(`  ctx.enemyPos: ${JSON.stringify(ctx.enemyPos)}`);
    console.log(`  ctx.enemyDir: ${ctx.enemyDir}`);
    console.log(`  ctx.enemyInvisibleFrames: ${sandbox.G_History.enemyInvisibleFrames}`);

    // Let's dry run findAssassinSpot with debugging logs
    const e = ctx.enemyPos;
    const dist = 5;
    const offsets = sandbox.getAssassinOffsets(ctx.enemyDir, dist);
    console.log(`Offsets for enemyDir=${ctx.enemyDir}, dist=${dist}: ${JSON.stringify(offsets)}`);

    for (let i = 0; i < offsets.length; i++) {
        const p = sandbox.addPos(e, offsets[i]);
        const passable = sandbox.isPassable(p, ctx.map);
        const canShootTarget = sandbox.canShoot(p, e, ctx.map);
        const safe = sandbox.isSafe(p, ctx, false, true);
        const isGrass = sandbox.G_Blueprint.mapVision.grass[p[0] + "," + p[1]] ? 1 : 0;
        
        console.log(`Offset ${i} (${JSON.stringify(offsets[i])}) -> Candidate Pos ${JSON.stringify(p)}:`);
        console.log(`  isPassable: ${passable}`);
        console.log(`  canShoot: ${canShootTarget}`);
        console.log(`  isSafe: ${safe}`);
        console.log(`  isGrass: ${isGrass}`);
    }

    const spot = sandbox.findAssassinSpot(ctx);
    console.log(`\nReturned Spot by findAssassinSpot: ${JSON.stringify(spot)}`);
}

main();
