const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('new_tank.js', 'utf8');

const printLogs = [];
const mockMe = {
    tank: { position: [5, 5], direction: 'up', crashed: false },
    stars: 3,
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
    stars: 3, // Equal stars
    skill: { type: 'freeze', remainingCooldownFrames: 0 }
};

const map = Array(20).fill(null).map(() => Array(15).fill('.'));
map[5][5] = 'o'; // Our current grass
map[4][5] = 'x';
map[5][4] = 'x';

const mockGame = {
    frames: 115, // Imminent timeout (> 110)
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

// Manually seed G_History
sandbox.G_History.frame = 115;
sandbox.G_History.enemies = {
    '0': {
        index: 0,
        pos: [6, 13],
        dir: 'down',
        frame: 115,
        visible: true,
        skillReady: true,
        skillType: 'freeze',
        hasOverload: false,
        overloaded: false
    }
};

console.log('=== RUNNING KILL MODE TIMEOUT TEST ===');
sandbox.onIdle(mockMe, mockEnemy, mockGame);
console.log('Is Kill Mode Active?', sandbox.G_History.killModeActive);
console.log('Actions called:', printLogs);
console.log('Decision evaluation candidates:');
const ctx = sandbox.buildExecutionContext(mockMe, mockEnemy, mockGame);
ctx.killMode = sandbox.G_History.killModeActive;
const best = sandbox.tacticalAnalysis(ctx);
console.log('Best action:', best);
