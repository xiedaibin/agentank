const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('new_tank.js', 'utf8');

function runTeleportTest(testName, killModeActive, canTeleport, starPos, enemyBullet) {
    console.log(`\n=== TELEPORT TEST: ${testName} ===`);
    
    const mockMe = {
        tank: { position: [5, 5], direction: 'up', crashed: false },
        stars: 2,
        status: { fireLocked: false, canActThisFrame: true },
        bullet: null,
        go: () => {},
        turn: () => {},
        fire: () => {},
        speak: () => {},
        skill: { type: 'teleport', remainingCooldownFrames: canTeleport ? 0 : 40 }
    };

    const mockEnemy = {
        tank: { id: 1414, position: [10, 10], direction: 'down', crashed: false },
        bullet: enemyBullet || null,
        stars: 3,
        skill: { type: 'freeze', remainingCooldownFrames: 0 }
    };

    const map = Array(20).fill(null).map(() => Array(15).fill('.'));

    const mockGame = {
        frames: 110,
        star: starPos,
        enemies: [mockEnemy],
        visibleBullets: enemyBullet ? [enemyBullet] : [],
        map: map,
        alivePlayers: 2
    };

    const sandbox = {
        print: () => {},
        console: console,
        Math: Math,
        Infinity: Infinity,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        me: mockMe,
        enemy: mockEnemy,
        game: mockGame
    };

    const script = new vm.Script(code);
    const context = vm.createContext(sandbox);
    script.runInContext(context);

    // Seed state
    sandbox.G_History.frame = 110;
    sandbox.G_History.killModeActive = killModeActive;
    sandbox.G_History.lastEnemyStars = 3;
    sandbox.G_History.lastEnemyPos = [10, 10];
    sandbox.G_History.enemies = {
        '0': { index: 0, pos: [10, 10], dir: 'down', frame: 105, visible: true }
    };

    // Run onIdle once to trigger strategicInit and map blueprint analysis
    sandbox.onIdle(mockMe, mockEnemy, mockGame);

    const ctx = sandbox.buildExecutionContext(mockMe, mockEnemy, mockGame);
    ctx.killMode = killModeActive;
    const best = sandbox.tacticalAnalysis(ctx);
    console.log('Result Decision:', best);
}

// Test Case 1: Kill Mode is inactive. Star is unsafe (enemy bullet is flying right towards the star).
// We should NOT teleport to the star.
const bulletHeadingForStar = {
    position: [6, 12],
    direction: 'up',
    by: 1
};
runTeleportTest("Kill Mode Inactive, Unsafe Star", false, true, [6, 7], bulletHeadingForStar);

// Test Case 2: Kill Mode is active. Star is unsafe (same bullet flying towards the star).
// Since Kill Mode is active, we bypass safety checks and teleport to the star!
runTeleportTest("Kill Mode Active, Unsafe Star", true, true, [6, 7], bulletHeadingForStar);

// Test Case 3: Kill Mode is active. No teleport cooldown. Star exists.
// We should teleport to the star.
runTeleportTest("Kill Mode Active, Safe Star", true, true, [6, 7], null);

// Test Case 4: Kill Mode is active. Teleport is on cooldown.
// We cannot teleport, so we walk or do other actions.
runTeleportTest("Kill Mode Active, Teleport on Cooldown", true, false, [6, 7], null);
