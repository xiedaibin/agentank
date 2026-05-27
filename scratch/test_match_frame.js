const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('new_tank.js', 'utf8');

const printLogs = [];
const mockMe = {
    tank: { position: [5, 2], direction: 'left', crashed: false },
    stars: 2,
    status: { fireLocked: false, canActThisFrame: true },
    bullet: null,
    go: function(dist) { printLogs.push(`me.go(${dist || ''})`); },
    turn: function(dir) { printLogs.push(`me.turn(${dir})`); },
    fire: function() { printLogs.push('me.fire()'); }
};

const mockEnemy = {
    tank: { position: [9, 6], direction: 'right', crashed: false },
    bullet: null,
    status: { fireLocked: false },
    skill: { type: 'shield', remainingCooldownFrames: 3 }
};

const mapString = "xxxxxxxxxxxxxxxxxxx|x....mm....oo....xx|x.a...........oo.ox|x....mm......xx.xox|xo..ooox.....xx...x|xo..o..mm.........x|x................mx|x.o.o.........o.o.x|xm................x|x.........mm..o..ox|x...xx.....xooo..ox|xox.xx......mm....x|xo.oo...........C.x|xx....oo....mm....x|xxxxxxxxxxxxxxxxxxx";
const rows = mapString.split('|');
const height = rows.length;
const width = rows[0].length;
const map = Array(width).fill(null).map(() => Array(height));
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        let char = rows[y][x];
        if (char === 'a' || char === 'C') char = '.';
        map[x][y] = char;
    }
}

const mockGame = {
    frames: 21,
    star: null,
    map: map
};

// Mock the global history context
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

// Pre-populate history to simulate the state at frame 21
context.G_History.frame = 21;
context.G_History.lastEnemyPos = [9, 6];
context.G_History.lastEnemyDir = 'right';
context.G_History.lastEnemySeenFrame = 21;

console.log('=== RUNNING MOCK onIdle AT FRAME 21 ===');
sandbox.onIdle(mockMe, mockEnemy, mockGame);
console.log('Actions called:', printLogs);
