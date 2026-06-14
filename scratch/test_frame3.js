const fs = require('fs');

global.print = console.log;

const tankCode = fs.readFileSync('new_tank.js', 'utf8');
eval(tankCode);

const matchData = JSON.parse(fs.readFileSync('targeted_evolution_replays/loss_3643_mat_4e9BRACBrCC8FmdhE.json', 'utf8'));
const replay = matchData.replayData?.replay || matchData.replay;
const records = replay.records || [];
const map = matchData.replayData?.map?.map || replay.meta?.map?.grid;

const myTankId = replay.meta.players[0].tank.id;
const enemyTankId = replay.meta.players[1].tank.id;

// Reconstruct global state
G_Blueprint.initialized = false;
G_Blueprint.enemySeen = false;
G_Blueprint.enemyProfile = null;
G_Blueprint.mapVision = null;

G_History.lastEnemyPos = null;
G_History.lastEnemyDir = "up";
G_History.lastEnemySeenFrame = -99;
G_History.frame = 0;

for (let fIdx = 0; fIdx <= 15; fIdx++) {
    const frameRecord = records[fIdx];
    
    // Find current positions from replay up to fIdx
    let myPos = [2, 2];
    let myDir = "up";
    let enemyPos = [16, 12];
    let enemyDir = "down";
    
    for (let i = 0; i <= fIdx; i++) {
        records[i].forEach(ev => {
            if (ev.type === 'tank') {
                if (ev.objectId === myTankId) {
                    if (ev.position) myPos = ev.position;
                    if (ev.direction) myDir = ev.direction;
                }
                if (ev.objectId === enemyTankId) {
                    if (ev.position) enemyPos = ev.position;
                    if (ev.direction) enemyDir = ev.direction;
                }
            }
            if (ev.type === 'skill' && ev.sourceObjectId === enemyTankId && ev.action === 'applied') {
                if (ev.to) enemyPos = ev.to;
            }
            if (ev.type === 'skill' && ev.sourceObjectId === myTankId && ev.action === 'applied') {
                if (ev.to) myPos = ev.to;
            }
        });
    }
    
    const isMyPosInGrass = G_Blueprint.mapVision && G_Blueprint.mapVision.grass[myPos[0] + "," + myPos[1]];
    const isEnemyPosInGrass = G_Blueprint.mapVision && G_Blueprint.mapVision.grass[enemyPos[0] + "," + enemyPos[1]];
    
    const enemyVisible = !isEnemyPosInGrass; // simple mock of grass visibility
    
    const mockMe = {
        stars: 0,
        bullet: null,
        status: { fireLocked: (fIdx === 2) }, // fire locked on frame 2 since we teleported on frame 2
        tank: { position: myPos, direction: myDir },
        skill: { type: "teleport", remainingCooldownFrames: (fIdx < 2) ? 0 : (40 - (fIdx - 2)) },
        turn: function(dir) { console.log(`[Frame ${fIdx}] [Action] me.turn(${dir})`); },
        go: function(steps) { console.log(`[Frame ${fIdx}] [Action] me.go(${steps || 1})`); },
        fire: function() { console.log(`[Frame ${fIdx}] [Action] me.fire()`); },
        teleport: function(x, y) { console.log(`[Frame ${fIdx}] [Action] me.teleport(${x}, ${y})`); },
        speak: function(txt) { console.log(`[Frame ${fIdx}] [Action] me.speak("${txt}")`); }
    };
    
    const mockEnemy = {
        stars: 0,
        bullet: null,
        status: { fireLocked: false, shielded: false },
        tank: enemyVisible ? { position: enemyPos, direction: enemyDir } : null,
        skill: { type: "teleport", remainingCooldownFrames: (fIdx === 0) ? 0 : (40 - fIdx) }
    };
    
    const mockGame = {
        frames: fIdx,
        star: [6, 8],
        map: map
    };
    
    console.log(`\n--- Frame ${fIdx} ---`);
    console.log(`MyPos: ${JSON.stringify(myPos)} (${myDir})`);
    console.log(`EnemyPos: ${JSON.stringify(enemyPos)} (${enemyDir}) (Visible: ${enemyVisible})`);
    
    console.log("Running onIdle...");
    try {
        onIdle(mockMe, mockEnemy, mockGame);
    } catch (e) {
        console.error("onIdle crashed:", e);
    }
    
    const ctx = buildExecutionContext(mockMe, mockEnemy, mockGame);
    const starAction = evalStarCollection(ctx);
    console.log(`[Frame ${fIdx}] evalStarCollection:`, JSON.stringify(starAction));
    if (starAction) {
        const next = getNextStep(ctx.myPos, starAction.target, ctx);
        console.log(`[Frame ${fIdx}] getNextStep:`, JSON.stringify(next));
    }
    const grassAction = evalGrassAmbushAndSurvival(ctx);
    console.log(`[Frame ${fIdx}] evalGrassAmbushAndSurvival:`, JSON.stringify(grassAction));
    const best = tacticalAnalysis(ctx);
    console.log(`[Frame ${fIdx}] bestAction chosen:`, JSON.stringify(best));
}
