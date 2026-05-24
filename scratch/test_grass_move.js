const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('new_tank.js', 'utf8');

const printLogs = [];
const mockMe = {
    tank: { position: [9, 7], direction: 'up', crashed: false },
    stars: 0,
    status: { fireLocked: false, canActThisFrame: true },
    bullet: null,
    go: function(dist) { printLogs.push(`me.go(${dist || ''}) called`); },
    turn: function(dir) { printLogs.push(`me.turn(${dir}) called`); },
    fire: function() { printLogs.push('me.fire() called'); }
};

// Enemy has shot a bullet moving LEFT, currently at [9, 7] (which hits [8, 7] next)
// Actually, let's put the bullet at [10, 7] moving left, so it will hit [8, 7] in 1 frame
const mockEnemy = {
    tank: { position: [11, 7], direction: 'left', crashed: false },
    bullet: { position: [10, 7], direction: 'left' },
    status: { fireLocked: false },
    skill: { remainingCooldownFrames: 10 }
};

// Build a classic map with grass 'o' at [8, 7] (unsafe) and [9, 10] (safe)
const map = Array(20).fill(null).map(() => Array(15).fill('.'));
map[8][7] = 'o'; // Nearest grass (unsafe)
map[9][10] = 'o'; // Safe grass

const mockGame = {
    frames: 10,
    star: null, // Star is not spawned yet (null)
    map: map
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

// Run the script in VM to populate functions
const script = new vm.Script(code);
const context = vm.createContext(sandbox);
script.runInContext(context);

console.log('=== RUNNING MOCK onIdle with UNSAFE grass ===');
sandbox.onIdle(mockMe, mockEnemy, mockGame);
console.log('Actions called:', printLogs);
console.log('G_Blueprint.mapVision.grass:', sandbox.G_Blueprint.mapVision.grass);
console.log('Nearest Safe Grass target:', sandbox.findNearestSafeGrass([9, 7], sandbox.buildExecutionContext(mockMe, mockEnemy, mockGame)));
