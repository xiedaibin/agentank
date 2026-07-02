const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'mat_5Xn2l2HZwZt2ONQIr_raw.json');
if (!fs.existsSync(rawPath)) {
    console.error("Raw replay not found.");
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const map = raw.replayData.map.map;

const myPos = [11, 7];
const enemyPos = [10, 5];
const enemyDir = "up";
const starPos = [14, 8];

// Print Map segment around star [14, 8]
console.log("Map Grid (XDB at [11,7] as 'O', Enemy at [10,5] as 'E', Star at [14,8] as '*'):");
for (let y = 3; y <= 11; y++) {
    let row = "";
    for (let x = 8; x <= 17; x++) {
        if (x === myPos[0] && y === myPos[1]) {
            row += "O ";
        } else if (x === enemyPos[0] && y === enemyPos[1]) {
            row += "E ";
        } else if (x === starPos[0] && y === starPos[1]) {
            row += "* ";
        } else {
            row += map[x][y] + " ";
        }
    }
    console.log(y.toString().padStart(2, '0') + ": " + row);
}

// Helpers
function getTile(p, map) {
    if (!p || !map || !map[p[0]] || !map[p[0]][p[1]]) return null;
    return map[p[0]][p[1]];
}
function isPassable(p, map) {
    var t = getTile(p, map);
    return t !== null && t !== "x" && t !== "m";
}
function getDist(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}
function samePos(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1];
}
function directionTo(a, b) {
    if (b[0] > a[0]) return "right";
    if (b[0] < a[0]) return "left";
    if (b[1] > a[1]) return "down";
    return "up";
}
function addPos(p, d) {
    return [p[0] + d[0], p[1] + d[1]];
}
function delta(d) {
    return { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d] || [0, 0];
}
function isLoS(s, e, dir, map) {
    if (!s || !e || (s[0] !== e[0] && s[1] !== e[1])) return false;
    if (samePos(s, e)) return true;
    if (directionTo(s, e) !== dir) return false;
    var st = delta(dir);
    var p = addPos(s, st), safety = 0;
    while (!samePos(p, e) && safety < 30) {
        var t = getTile(p, map);
        if (t === "x" || t === "m") return false;
        p = addPos(p, st); safety++;
    }
    return samePos(p, e);
}
function canShoot(a, b, map) {
    if (!a || !b || samePos(a, b) || (a[0] !== b[0] && a[1] !== b[1])) return false;
    var d = directionTo(a, b), st = delta(d);
    var p = addPos(a, st), blockedByMound = false, safety = 0;
    while (!samePos(p, b) && safety < 30) {
        var t = getTile(p, map);
        if (t === "x") return false;
        if (t === "m") blockedByMound = true;
        p = addPos(p, st); safety++;
    }
    return samePos(p, b) ? (blockedByMound ? "mound" : true) : false;
}

// Mimic ctx
const ctx = {
    myPos: myPos,
    enemyPos: enemyPos,
    enemyDir: enemyDir,
    starPos: starPos,
    map: map,
    enemyFireLocked: false,
    enemySkillReady: false,
    me: { stars: 1 },
    enemy: { stars: 2 },
    meStars: 1,
    enemyStars: 2
};

function isSafe(pos, ctx, checkBullets, isAssassinationSpot) {
    // In this frame, there are no bullets.
    return true; 
}

function isSafeForStarTeleport(pos, ctx, isAssassinationSpot) {
    if (!isSafe(pos, ctx, true, isAssassinationSpot)) return false;
    if (ctx.enemyPos) {
        var d = getDist(pos, ctx.enemyPos);
        if (!isAssassinationSpot && d <= 2) {
            console.log(`  -> isSafeForStarTeleport([${pos}]) failed: dist to enemy too close (${d} <= 2)`);
            return false;
        }
        if (!isAssassinationSpot) {
            // 只要落点暴露在敌人枪线上且敌人开火锁未激活，就禁止传送
            if (isOnEnemyGunLine(pos, ctx, true) && !ctx.enemyFireLocked) {
                console.log(`  -> isSafeForStarTeleport([${pos}]) failed: exposed on enemy gun line`);
                return false;
            }
            if (d <= 8 && !ctx.enemyFireLocked) {
                var mainOnAxis = (pos[0] === ctx.enemyPos[0] || pos[1] === ctx.enemyPos[1]);
                if (mainOnAxis && canShoot(ctx.enemyPos, pos, ctx.map) === true) {
                    console.log(`  -> isSafeForStarTeleport([${pos}]) failed: d <= 8 and mainAxis matched with canShoot`);
                    return false;
                }
            }
        }
    }
    return true;
}

function isOnEnemyGunLine(pos, ctx, checkOverload) {
    if (!ctx.enemyPos || !ctx.enemyDir) return false;
    var mainOrigin = ctx.enemyPos;
    if (isLoS(mainOrigin, pos, ctx.enemyDir, ctx.map)) return true;
    return false;
}

console.log("\nEvaluating targets for star grab teleport:");
var adjs = [
    [starPos[0], starPos[1] - 1], // [14, 7]
    [starPos[0], starPos[1] + 1], // [14, 9]
    [starPos[0] - 1, starPos[1]], // [13, 8]
    [starPos[0] + 1, starPos[1]]  // [15, 8]
];

for (let i = 0; i < adjs.length; i++) {
    let p = adjs[i];
    let passable = isPassable(p, map);
    let tile = getTile(p, map);
    console.log(`Adj ${i}: p=[${p}], tile='${tile}', passable=${passable}`);
    if (passable) {
        let safe = isSafeForStarTeleport(p, ctx);
        console.log(`  -> isSafeForStarTeleport: ${safe}`);
    }
}
