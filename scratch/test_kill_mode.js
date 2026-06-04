const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('new_tank.js', 'utf8');

function runTest(testName, frames, meStars, enemyStars, alivePlayers, enemyVisible, starPos, enemyPos) {
    console.log(`\n=== TEST CASE: ${testName} ===`);
    console.log(`  (frame: ${frames}, stars: ${meStars} vs ${enemyStars}, alivePlayers: ${alivePlayers}, enemyVisible: ${enemyVisible}, star: ${starPos ? JSON.stringify(starPos) : 'null'})`);
    
    const printLogs = [];
    const mockMe = {
        tank: { position: [5, 5], direction: 'up', crashed: false },
        stars: meStars,
        status: { fireLocked: false, canActThisFrame: true },
        bullet: null,
        go: function(dist) { printLogs.push(`me.go(${dist || ''}) called`); },
        turn: function(dir) { printLogs.push(`me.turn(${dir}) called`); },
        fire: function() { printLogs.push('me.fire() called'); },
        speak: function(text) { printLogs.push(`me.speak("${text}")`); }
    };

    const mockEnemy = {
        tank: enemyVisible ? { id: 1414, position: enemyPos || [6, 13], direction: 'down', crashed: false } : null,
        bullet: null,
        stars: enemyStars,
        skill: { type: 'freeze', remainingCooldownFrames: 0 }
    };

    const map = Array(20).fill(null).map(() => Array(15).fill('.'));
    map[5][5] = 'o'; // Our current grass
    map[4][5] = 'x';
    map[5][4] = 'x';
    if (testName.includes("Threat Pre-Aiming")) {
        map[5][8] = 'x';
    }

    const mockGame = {
        frames: frames,
        star: starPos || null,
        enemies: enemyVisible ? [mockEnemy] : [],
        map: map,
        alivePlayers: alivePlayers
    };

    const sandbox = {
        print: function(...args) { console.log('[Tank Print]', ...args); },
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

    // Seed G_History enemies state
    sandbox.G_History.frame = frames;
    sandbox.G_History.enemies = {
        '0': {
            index: 0,
            pos: enemyPos || [6, 13],
            dir: 'down',
            frame: frames - 5,
            visible: enemyVisible,
            skillReady: true,
            skillType: 'freeze',
            hasOverload: false,
            overloaded: false
        }
    };
    sandbox.G_History.lastEnemyStars = enemyStars;
    sandbox.G_History.lastEnemyPos = enemyPos || [6, 13];

    sandbox.onIdle(mockMe, mockEnemy, mockGame);

    console.log('Is Kill Mode Active?', sandbox.G_History.killModeActive);
    console.log('Record at 120 stars:', sandbox.G_History.starsAt120);
    console.log('Actions called:', printLogs);
    
    const ctx = sandbox.buildExecutionContext(mockMe, mockEnemy, mockGame);
    ctx.killMode = sandbox.G_History.killModeActive;
    const best = sandbox.tacticalAnalysis(ctx);
    console.log('Best Action Decision:', best);
}

// Case 1: Early frame, equal stars. Should NOT trigger Kill Mode.
runTest("Early Frame Equal Stars", 115, 3, 3, 2, true);

// Case 2: Frame 120, lagging stars, enemy invisible. Should trigger and record.
runTest("Frame 120 Lagging Stars (Enemy Invisible)", 120, 3, 4, 2, false);

// Case 3: Frame 120, equal stars, 3 players alive (Raid melee). Should record, but NOT trigger yet.
runTest("Frame 120 Equal Stars (3 Players Alive)", 120, 3, 3, 3, true);

// Case 4: Frame 150 (extreme timeout), equal stars, 3 players alive. Should trigger.
runTest("Frame 150 Equal Stars (3 Players Alive - Extreme Timeout)", 150, 3, 3, 3, true);

// Case 5: Threat Pre-Aiming. No stars, early game, enemy below at [5, 13]. Should turn down.
runTest("Threat Pre-Aiming (No Stars, Enemy Below)", 50, 3, 3, 2, true, null, [5, 13]);
