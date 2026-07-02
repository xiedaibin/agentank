const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'mat_6dFX9uZthorHANLdY_raw.json');
if (!fs.existsSync(rawPath)) {
    console.error("Raw replay not found.");
    process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
const map = raw.replayData.map.map;
const width = map.length;
const height = map[0].length;

console.log("Map Size:", width, "x", height);
console.log("\nMap ASCII Grid (XDB at [12,5] marked as 'O', Enemy at [11,2] marked as 'E'):");

// Print the grid
for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
        if (x === 12 && y === 5) {
            row += "O ";
        } else if (x === 11 && y === 2) {
            row += "E ";
        } else {
            row += map[x][y] + " ";
        }
    }
    console.log(y.toString().padStart(2, '0') + ": " + row);
}

// Print path calculations
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

const myPos = [12, 5];
const enemyPos = [11, 2];
const enemyDir = "down";

console.log("\nTesting findPreAimDir steps:");
var d = delta(enemyDir);
var p = enemyPos.slice();
for (var i = 1; i <= 6; i++) {
    p = addPos(p, d);
    var tile = getTile(p, map);
    var passable = isPassable(p, map);
    console.log(`Step ${i}: p=[${p}], tile='${tile}', passable=${passable}`);
    if (!passable) {
        console.log(`  -> Terminated due to obstacle at [${p}]`);
        break;
    }

    if (p[0] === myPos[0] || p[1] === myPos[1]) {
        var cs = canShoot(myPos, p, map);
        console.log(`  -> Axis matched! canShoot([${myPos}], [${p}]) = ${cs}`);
    }
}
