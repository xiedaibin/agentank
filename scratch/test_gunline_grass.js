const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('new_tank.js', 'utf8');

const printLogs = [];
const mockMe = {
    tank: { position: [8, 7], direction: 'up', crashed: false },
    stars: 0,
    status: { fireLocked: false, canActThisFrame: true },
    bullet: null,
    go: function(dist) { printLogs.push(`me.go(${dist || ''}) called`); },
    turn: function(dir) { printLogs.push(`me.turn(${dir}) called`); },
    fire: function() { printLogs.push('me.fire() called'); }
};

// Enemy is NOT visible, but in game.enemies we don't have it visible this frame.
// However, we want to mock G_History.enemies where they were seen at [12, 7] facing left, 5 frames ago.
// We pass enemy = null to onIdle.
const mockEnemy = null;

const map = Array(20).fill(null).map(() => Array(15).fill('.'));
map[8][7] = 'o'; // Our current grass
map[9][10] = 'o'; // Safe grass

const mockGame = {
    frames: 10,
    star: null,
    enemies: [], // No visible enemies
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

// Manually seed G_History
sandbox.G_History.frame = 10;
sandbox.G_History.enemies = {
    '0': {
        index: 0,
        pos: [12, 7],
        dir: 'left',
        frame: 5, // Seen 5 frames ago
        visible: false,
        skillReady: false,
        skillType: 'shield',
        hasOverload: false,
        overloaded: false
    }
};

console.log('=== RUNNING MOCK with tracked invisible enemy ===');
sandbox.onIdle(mockMe, mockEnemy, mockGame);
console.log('Actions called:', printLogs);
console.log('Is our current position safe?', sandbox.isSafe([8, 7], sandbox.buildExecutionContext(mockMe, mockEnemy, mockGame), true));
console.log('Nearest Safe Grass target:', sandbox.findNearestSafeGrass([8, 7], sandbox.buildExecutionContext(mockMe, mockEnemy, mockGame)));
