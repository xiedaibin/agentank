const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('new_tank.js', 'utf8');

function runTrapTest() {
    console.log("=== RUNNING TRAP & TELEPORT EXCEPTION TESTS ===");

    // Construct a map with a trapped grass pocket at (1, 1), (1, 2), (1, 3) surrounded by stone 'x'
    const map = Array(20).fill(null).map(() => Array(15).fill('.'));
    
    // Trapped pocket:
    map[1][1] = 'o';
    map[1][2] = 'o';
    map[1][3] = 'o';
    
    // Surrounded by stone walls:
    for (let x = 0; x <= 2; x++) {
        for (let y = 0; y <= 4; y++) {
            if (!(x === 1 && (y === 1 || y === 2 || y === 3))) {
                map[x][y] = 'x';
            }
        }
    }

    // Open grass at (5, 5) and (5, 6)
    map[5][5] = 'o';
    map[5][6] = 'o';

    const mockMe = {
        tank: { position: [5, 5], direction: 'up', crashed: false },
        stars: 3,
        status: { fireLocked: false, canActThisFrame: true },
        skill: { type: 'teleport', remainingCooldownFrames: 0 },
        bullet: null,
        go: function() {},
        turn: function() {},
        fire: function() {},
        speak: function() {},
        teleport: function(x, y) { console.log(`  [Action] me.teleport(${x}, ${y}) called`); }
    };

    const mockEnemy = {
        tank: { id: 1414, position: [15, 15], direction: 'down', crashed: false }, // Move enemy further away
        bullet: null,
        stars: 3,
        skill: { type: 'freeze', remainingCooldownFrames: 0 }
    };

    const mockGame = {
        frames: 10,
        star: null,
        enemies: [mockEnemy],
        map: map,
        alivePlayers: 2
    };

    const sandbox = {
        print: console.log,
        console: console,
        Math: Math,
        Infinity: Infinity,
        me: mockMe,
        enemy: mockEnemy,
        game: mockGame
    };

    const script = new vm.Script(code);
    const context = vm.createContext(sandbox);
    script.runInContext(context);

    // Initialize map
    sandbox.strategicInit(mockEnemy, map);

    // 1. Test isolated pocket detection
    const trappedSet = sandbox.G_Blueprint.mapVision.trapped;
    console.log("Is (1, 1) trapped?", !!trappedSet["1,1"]);
    console.log("Is (1, 2) trapped?", !!trappedSet["1,2"]);
    console.log("Is (1, 3) trapped?", !!trappedSet["1,3"]);
    console.log("Is (5, 5) trapped?", !!trappedSet["5,5"]);

    // 2. Test hasWalkableExit
    console.log("hasWalkableExit(1, 2):", sandbox.hasWalkableExit([1, 2], map));
    console.log("hasWalkableExit(5, 5):", sandbox.hasWalkableExit([5, 5], map));

    // 3. Test findSafeGrassSpot - should not pick (1, 2)
    const ctx = sandbox.buildExecutionContext(mockMe, mockEnemy, mockGame);
    const safeGrass = sandbox.findSafeGrassSpot(ctx);
    console.log("Safe grass chosen (should be near 5,5 or 5,6 and NOT trapped):", safeGrass);

    // 4. Test Star Grab Override (Star in trapped area)
    mockGame.star = [1, 2]; // Star inside trapped pocket
    const ctxForStar = sandbox.buildExecutionContext(mockMe, mockEnemy, mockGame);
    
    // Let's inspect variables
    const myComp = sandbox.G_Blueprint.mapVision.componentIds[ctxForStar.myPos[0] + "," + ctxForStar.myPos[1]];
    const starComp = sandbox.G_Blueprint.mapVision.componentIds[ctxForStar.starPos[0] + "," + ctxForStar.starPos[1]];
    const isUnreachable = (myComp !== undefined && starComp !== undefined && myComp !== starComp);
    const safeForTeleport = sandbox.isSafeForStarTeleport(ctxForStar.starPos, ctxForStar);
    console.log("Diagnostics for star inside trap:");
    console.log("  myPos:", ctxForStar.myPos, "myComp:", myComp);
    console.log("  starPos:", ctxForStar.starPos, "starComp:", starComp);
    console.log("  isUnreachable:", isUnreachable);
    console.log("  canTeleport:", ctxForStar.canTeleport);
    console.log("  safeForTeleport:", safeForTeleport);
    console.log("  enemies tracked:", JSON.stringify(ctxForStar.trackedEnemies));

    const starAction = sandbox.evalStarCollection(ctxForStar);
    console.log("Star collection decision when star is inside trap:", starAction);

    // 5. Test escaping from trap
    // Place tank inside the trap:
    mockMe.tank.position = [1, 2];
    mockGame.star = [5, 5]; // Star outside the trap
    const escapeAction = sandbox.evalStarCollection(sandbox.buildExecutionContext(mockMe, mockEnemy, mockGame));
    console.log("Star collection decision when tank is trapped and star is outside:", escapeAction);
}

runTrapTest();
