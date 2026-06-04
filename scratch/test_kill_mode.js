const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('new_tank.js', 'utf8');

function runTest(testName, frames, meStars, enemyStars) {
    console.log(`\n=== TEST CASE: ${testName} (frame: ${frames}, stars: ${meStars} vs ${enemyStars}) ===`);
    
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
        tank: { id: 1414, position: [6, 13], direction: 'down', crashed: false },
        bullet: null,
        stars: enemyStars,
        skill: { type: 'freeze', remainingCooldownFrames: 0 }
    };

    const map = Array(20).fill(null).map(() => Array(15).fill('.'));
    map[5][5] = 'o'; // Our current grass
    map[4][5] = 'x';
    map[5][4] = 'x';

    const mockGame = {
        frames: frames,
        star: null, // No star on map
        enemies: [mockEnemy],
        map: map,
        alivePlayers: 2
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
            pos: [6, 13],
            dir: 'down',
            frame: frames,
            visible: true,
            skillReady: true,
            skillType: 'freeze',
            hasOverload: false,
            overloaded: false
        }
    };

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
runTest("Early Frame Equal Stars", 115, 3, 3);

// Case 2: Frame 120, lagging stars (3 vs 4). Should trigger Kill Mode and record star counts.
runTest("Frame 120 Lagging Stars", 120, 3, 4);

// Case 3: Frame 120, equal stars (3 vs 3). Should record star counts, but NOT trigger Kill Mode yet.
runTest("Frame 120 Equal Stars", 120, 3, 3);

// Case 4: Frame 150 (extreme timeout), equal stars (3 vs 3). Should trigger Kill Mode.
runTest("Frame 150 Equal Stars (Extreme Timeout)", 150, 3, 3);
