function directionTo(a, b) { if (b[0] > a[0]) return "right"; if (b[0] < a[0]) return "left"; if (b[1] > a[1]) return "down"; return "up"; }

function getTurnDir(currentDir, targetDir, enemyPos, myPos) {
    if (!targetDir || currentDir === targetDir) return null;
    var dirs = ["up", "right", "down", "left"];
    var curIdx = dirs.indexOf(currentDir);
    var tarIdx = dirs.indexOf(targetDir);
    if (curIdx === -1 || tarIdx === -1) return null;
    var diff = (tarIdx - curIdx + 4) % 4;
    if (diff === 1) return "right";
    if (diff === 3) return "left";
    
    // diff === 2 (180 degrees turn): Avoid turning towards the enemy if possible
    if (enemyPos && myPos) {
        var dirToEnemy = directionTo(myPos, enemyPos);
        var intermediateRight = dirs[(curIdx + 1) % 4];
        var intermediateLeft = dirs[(curIdx + 3) % 4];
        if (intermediateRight === dirToEnemy) return "left";
        if (intermediateLeft === dirToEnemy) return "right";
    }
    return "right";
}

console.log("getTurnDir('left', 'right', [9,1], [1,1]) =", getTurnDir('left', 'right', [9,1], [1,1]));
console.log("getTurnDir('up', 'down', [9,1], [1,1]) =", getTurnDir('up', 'down', [9,1], [1,1]));
