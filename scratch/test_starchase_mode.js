/**
 * 测试 StarChase Mode：单挑期有星时，坦克应优先吃星而非转炮瞄准
 */
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('new_tank.js', 'utf8');

function runTest(desc, mockMe, mockEnemy, mockGame, expectedAction) {
    const logs = [];
    const me = Object.assign({}, mockMe, {
        go:       (d)   => logs.push(`go(${d||''})`),
        turn:     (dir) => logs.push(`turn(${dir})`),
        fire:     ()    => logs.push('fire()'),
        teleport: (x,y) => logs.push(`teleport(${x},${y})`),
        speak:    (t)   => logs.push(`speak("${t}")`),
        skill:    { remainingCooldownFrames: 5 },  // 默认技能 CD 中
    });
    me.tank = Object.assign({}, mockMe.tank);

    const sandbox = {
        print: (...a) => {},
        console: console,
        Math, Infinity,
        setTimeout, clearTimeout,
        me, enemy: mockEnemy, game: mockGame,
        G_Blueprint: undefined, G_History: undefined
    };

    const script = new vm.Script(code);
    const ctx = vm.createContext(sandbox);
    script.runInContext(ctx);
    sandbox.onIdle(me, mockEnemy, mockGame);

    const actions = logs.filter(l => !l.startsWith('speak'));
    const pass = actions[0] && actions[0].startsWith(expectedAction);
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${desc}`);
    console.log(`  期望: ${expectedAction}  实际: ${actions[0] || '(无动作)'}`);
    if (!pass) console.log(`  所有行为: ${JSON.stringify(logs)}`);
}

// 建一张简单地图
const map = Array(20).fill(null).map(() => Array(15).fill('.'));
map[9][10] = 'o';   // 安全草丛
map[5][5]  = 'o';   // 另一个草丛

// 基础坦克状态
const baseMe = {
    tank: { position: [2, 2], direction: 'down', crashed: false },
    stars: 0,
    status: { fireLocked: false, canActThisFrame: true },
    bullet: null,
};

// 敌人在 [16, 2]，面朝 down，不在我们的枪线上，距离 14 格
const farEnemy = {
    index: 0,
    tank: { position: [16, 2], direction: 'down', crashed: false },
    bullet: null,
    status: { fireLocked: false },
    skill: { type: 'shield', remainingCooldownFrames: 10 }
};

console.log('=== StarChase Mode 测试 ===\n');

// 测试1: 单挑期 + 有星 + 敌人不在枪线 → 应该走向星星，不转炮
runTest(
    '单挑期+有星: 应走向星星，不转炮追敌',
    baseMe,
    farEnemy,
    { frames: 50, star: [10, 10], enemies: [farEnemy], alivePlayers: 2, map },
    'go'  // 走向星星
);

// 测试2: 单挑期 + 无星 → 可以对敌人开炮/转向
runTest(
    '单挑期+无星: 可以转炮瞄准或追击',
    baseMe,
    farEnemy,
    { frames: 50, star: null, enemies: [farEnemy], alivePlayers: 2, map },
    'turn'  // 转向敌人追击
);

// 测试3: 多敌混战期 + 有星 → 正常逻辑（吃星权重降低，偏向草丛）
runTest(
    '多敌混战期: 草丛优先或抑制吃星',
    baseMe,
    farEnemy,
    { frames: 50, star: [10, 10], enemies: [farEnemy], alivePlayers: 3, map },
    'turn'  // 多敌期吃星权重低，可能转向追敌或去草丛
);

console.log('\n=== 测试完成 ===');
