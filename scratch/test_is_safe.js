const fs = require('fs');
const vm = require('vm');

const newTankCode = fs.readFileSync('new_tank.js', 'utf8');

const sandbox = {
    print: console.log,
    console: console,
    Math: Math,
};

const runCode = new Function('sandbox', `
    with (sandbox) {
        ${newTankCode}
        sandbox.findOffAxisMove = findOffAxisMove;
        sandbox.isSafe = isSafe;
        sandbox.isOnEnemyGunLine = isOnEnemyGunLine;
        sandbox.isEnemyOverloadActive = isEnemyOverloadActive;
        sandbox.strategicInit = strategicInit;
    }
`);

runCode(sandbox);

// Setup map
const rawData = JSON.parse(fs.readFileSync('scratch/mat_LlBgqKMekroHwcmvw_raw.json', 'utf8'));
const map = rawData.replayData.map.map;

// Strategic Init
sandbox.strategicInit({ skill: { type: "overload" } }, map);

// Setup context
const ctx = {
    myPos: [5,7],
    myDir: "left",
    enemyPos: [4,9],
    enemyDir: "up",
    map: map,
    enemy: {
        status: { overloaded: true },
        skill: { type: "overload", remainingCooldownFrames: 32 }
    },
    enemySkillReady: false,
    me: { bullet: null },
    meStatus: {}
};

// Run isEnemyOverloadActive
sandbox.G_History = { frame: 20 };
console.log("isEnemyOverloadActive:", sandbox.isEnemyOverloadActive(ctx, [5,7]));

// Run isOnEnemyGunLine
console.log("isOnEnemyGunLine([5,7]):", sandbox.isOnEnemyGunLine([5,7], ctx, true));

// Run findOffAxisMove
const res = sandbox.findOffAxisMove(ctx);
console.log("findOffAxisMove result:", JSON.stringify(res));
