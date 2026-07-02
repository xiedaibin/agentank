const fs = require('fs');
const path = require('path');

// Reconstruct the logic of the tank code
const tankCodePath = path.join(__dirname, '../new_tank.js');
const rawReplayPath = path.join(__dirname, 'mat_5Xn2l2HZwZt2ONQIr_raw.json');

if (!fs.existsSync(tankCodePath) || !fs.existsSync(rawReplayPath)) {
    console.error("Missing files.");
    process.exit(1);
}

// Load replay frames
const raw = JSON.parse(fs.readFileSync(rawReplayPath, 'utf8'));
const frames = raw.replayData.replay.records;

// We want to investigate XDB's context at Frame 124 (which is 1-indexed, index 123 in frames array)
const targetFrameIndex = 123; // Frame 124
const frameData = frames[targetFrameIndex];

// Let's run a sandbox-like emulation of the frame context
// XDB ID in this match is 'b794d358'
const meId = 'b794d358';
const enemyId = '6754f903';

// Extract state
let meState, enemyState;
for (const id in frameData.tanks) {
    if (id === meId) meState = frameData.tanks[id];
    else enemyState = frameData.tanks[id];
}

console.log("=== Target Frame 124 Emulation ===");
console.log("XDB Position:", meState.position, "Dir:", meState.direction, "Cooldown:", meState.skill ? meState.skill.remainingCooldownFrames : 'none');
console.log("Enemy Position:", enemyState.position, "Dir:", enemyState.direction);
console.log("Star Position:", frameData.star);

// Let's dynamically evaluate the code logic by evaluating parts of the file
const code = fs.readFileSync(tankCodePath, 'utf8');

// Inject the entire code inside an execution sandbox to print internals
const vm = require('vm');

const mockMe = {
    tank: meState,
    stars: meState.stars,
    bullet: meState.bullet,
    status: meState.status,
    skill: meState.skill,
    speak: function(msg) { console.log("🤖 Speak called:", msg); }
};

const mockEnemy = {
    tank: enemyState,
    stars: enemyState.stars,
    bullet: enemyState.bullet,
    status: enemyState.status,
    skill: enemyState.skill
};

const mockGame = {
    frames: 124,
    map: raw.replayData.map,
    tanks: [mockEnemy, mockMe] // index 1 is me (b794d358)
};

// Set up globals that new_tank.js expects
const sandbox = {
    console: console,
    require: require,
    me: mockMe,
    enemy: mockEnemy,
    game: mockGame,
    // We will capture G_History and G_Blueprint
    G_History: {
        frame: 124,
        lastEnemySeenFrame: 124,
        lastEnemyPos: enemyState.position,
        lastEnemyDir: enemyState.direction,
        lastEnemyVisible: true,
        wasEnemyVisible: true,
        enemyInvisibleFrames: 0,
        postTeleportFrames: 0,
        starTeleportFrame: -99,
        failedTeleportSpots: {},
        lastActionType: "star"
    },
    G_Blueprint: {
        mapVision: {
            grass: {},
            grassList: []
        },
        Tactics: {
            STANCE: "ANTI_TELEPORT", // Default stance from new_tank strategicInit
            ENABLE_ASSASSINATION: true
        }
    }
};

// Fill G_Blueprint.mapVision
const mapData = raw.replayData.map.map;
const width = mapData.length;
const height = mapData[0].length;
for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
        if (mapData[x][y] === 'o') {
            sandbox.G_Blueprint.mapVision.grass[x + ',' + y] = true;
            sandbox.G_Blueprint.mapVision.grassList.push([x, y]);
        }
    }
}

// Compile and run
const script = new vm.Script(code + `
// Run onIdle wrapper
const ctx = {
    myPos: me.tank.position,
    myDir: me.tank.direction,
    enemyPos: enemy.tank.position,
    enemyDir: enemy.tank.direction,
    enemyVisible: true,
    starPos: game.map.star,
    map: game.map,
    canTeleport: me.skill && me.skill.remainingCooldownFrames === 0,
    me: me.tank,
    enemy: enemy.tank,
    meStars: me.stars,
    enemyStars: enemy.stars,
    meStatus: me.status,
    enemyStatus: enemy.status,
    enemyFireLocked: enemy.status && enemy.status.fireLocked,
    enemySkillReady: enemy.skill && enemy.skill.remainingCooldownFrames === 0,
    isUrgentStarGrab: (G_History.frame >= 124) && (me.stars <= enemy.stars)
};

console.log("\\nctx.canTeleport:", ctx.canTeleport);
console.log("ctx.isUrgentStarGrab:", ctx.isUrgentStarGrab);
console.log("ctx.meStars:", ctx.meStars, "ctx.enemyStars:", ctx.enemyStars);

const tpTarget = findBestStarTeleportTarget(ctx);
console.log("findBestStarTeleportTarget:", tpTarget);
if (tpTarget) {
    console.log("  -> isTeleportPassable:", isTeleportPassable(tpTarget, ctx));
    console.log("  -> getDist:", getDist(ctx.myPos, tpTarget));
}

console.log("\\n--- Evaluating rawCandidates in tacticalAnalysis ---");
const rawCandidates = [];
rawCandidates.push({ name: 'evalAssassination', act: evalAssassination(ctx) });
rawCandidates.push({ name: 'evalShooting', act: evalShooting(ctx) });
rawCandidates.push({ name: 'evalPreAim', act: evalPreAim(ctx) });
rawCandidates.push({ name: 'evalStarCollection', act: evalStarCollection(ctx) });
rawCandidates.push({ name: 'evalStarGuard', act: evalStarGuard(ctx) });
rawCandidates.push({ name: 'evalGrassAmbushAndSurvival', act: evalGrassAmbushAndSurvival(ctx) });

rawCandidates.forEach(c => {
    console.log(c.name + ":", JSON.stringify(c.act));
});
`);

vm.createContext(sandbox);
script.runInContext(sandbox);
