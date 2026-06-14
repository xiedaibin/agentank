const fs = require('fs');
const path = require('path');

// Mock a simple print function for new_tank's use
global.print = console.log;

// Load the new_tank script as text and evaluate it in the global context
const tankCode = fs.readFileSync('new_tank.js', 'utf8');
eval(tankCode);

// Load match data
const matchData = JSON.parse(fs.readFileSync('targeted_evolution_replays/loss_3773_mat_AaAaETux48P0sNNOq.json', 'utf8'));
const replay = matchData.replayData?.replay || matchData.replay;
const records = replay.records || [];
const map = matchData.replayData?.map?.map || replay.meta?.map?.grid;

const challenger = matchData.participants.challenger;
const defender = matchData.participants.defender;
const isChallengerMe = challenger.tankId === 230 || challenger.tankName === 'XDB';

const myIndex = isChallengerMe ? 0 : 1;
const enemyIndex = isChallengerMe ? 1 : 0;

const myTankId = replay.meta.players[myIndex].tank.id;
const enemyTankId = replay.meta.players[enemyIndex].tank.id;

// We want to run debug for Frame 2
// The state of Frame 2 is built by processing Frame 0 and Frame 1, and then running on Frame 2
// Let's reconstruct the global state (G_History, G_Blueprint) frame by frame

function runSimulation() {
    console.log("Reconstructing history frame by frame...");
    
    // Clear global state
    G_Blueprint.initialized = false;
    G_Blueprint.enemySeen = false;
    G_Blueprint.enemyProfile = null;
    G_Blueprint.mapVision = null;
    
    G_History.lastEnemyPos = null;
    G_History.lastEnemyDir = "up";
    G_History.lastEnemySeenFrame = -99;
    G_History.frame = 0;
    
    for (let fIdx = 0; fIdx <= 13; fIdx++) {
        console.log(`\n--- Reconstructing Frame ${fIdx} ---`);
        const frameRecord = records[fIdx];
        
        // Reconstruct me and enemy structures from the replay
        let meTankRecord = null;
        let enemyTankRecord = null;
        
        // Find me and enemy in replay records
        frameRecord.forEach(ev => {
            if (ev.type === 'tank') {
                if (ev.objectId === myTankId) meTankRecord = ev;
                if (ev.objectId === enemyTankId) enemyTankRecord = ev;
            }
        });
        
        // If not found in current frame, look at previous frames to find their status
        // For me
        let myPos = [1, 2]; // default start
        let myDir = "up";
        let myStars = 0;
        let meBullet = null;
        let myFireLocked = false;
        
        // For enemy
        let enemyPos = [17, 12]; // default start
        let enemyDir = "up";
        let enemyStars = 0;
        let enemyBullet = null;
        let enemyFireLocked = false;
        
        // Re-read positions by scanning from Frame 0 to current frame
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
            });
        }
        
        // Mock me object for onIdle
        const mockMe = {
            stars: 0,
            bullet: null,
            status: { fireLocked: false, stunned: false, frozen: false },
            tank: { position: myPos, direction: myDir },
            skill: { type: "teleport", remainingCooldownFrames: Math.max(0, 4 - fIdx) }, // Mock skill for me
            turn: function(dir) { console.log(`[Action] me.turn(${dir})`); },
            go: function(steps) { console.log(`[Action] me.go(${steps || 1})`); },
            fire: function() { console.log(`[Action] me.fire()`); },
            teleport: function(x, y) { console.log(`[Action] me.teleport(${x}, ${y})`); },
            speak: function(txt) { console.log(`[Action] me.speak("${txt}")`); }
        };
        
        // Mock enemy object
        // For Agro, remainingCooldownFrames decreases each frame
        let remainingCD = Math.max(0, 40 - fIdx + 1);
        
        const mockEnemy = {
            stars: 0,
            bullet: null,
            status: { fireLocked: true, shielded: false },
            tank: (fIdx >= 2) ? null : { position: enemyPos, direction: enemyDir },
            skill: { type: "teleport", remainingCooldownFrames: remainingCD }
        };
        
        const mockGame = {
            frames: fIdx,
            star: [11, 4],
            map: map
        };
        
        console.log(`MyPos: ${JSON.stringify(myPos)} Dir: ${myDir}`);
        console.log(`EnemyPos: ${JSON.stringify(enemyPos)} Dir: ${enemyDir} (Visible: ${!!(mockEnemy && mockEnemy.tank)})`);
        
        // Run onIdle
        onIdle(mockMe, mockEnemy, mockGame);
        
        // Let's print out what evaluation functions produce on Frame 11
        if (fIdx === 11) {
            console.log("\n=== Frame 11 Evaluation Debug ===");
            const ctx = buildExecutionContext(mockMe, mockEnemy, mockGame);
            console.log("ctx.enemyPos:", JSON.stringify(ctx.enemyPos));
            console.log("ctx.enemyDir:", ctx.enemyDir);
            console.log("ctx.canTeleport:", ctx.canTeleport);
            
            const isEnemyAmbushing = !ctx.enemyVisible && ctx.enemy && ctx.enemy.skill && ctx.enemy.skill.type === "teleport" && ctx.enemy.skill.remainingCooldownFrames > 0;
            console.log("isEnemyAmbushing (raw):", isEnemyAmbushing);
            
            const isEnemyAmbushingReal = !ctx.enemyVisible && G_Blueprint.enemyProfile && G_Blueprint.enemyProfile.skillType === "teleport" && G_History.enemyTeleportCooldown > 0;
            console.log("isEnemyAmbushing (real):", isEnemyAmbushingReal);
            
            const spot = findAssassinSpot(ctx);
            console.log("findAssassinSpot:", JSON.stringify(spot));
            
            if (spot) {
                const safeForStarTeleport = isSafeForStarTeleport(spot, ctx, true);
                console.log("isSafeForStarTeleport:", safeForStarTeleport);
                
                const isSafeDirect = isSafe(spot, ctx, true, true);
                console.log("isSafe (direct):", isSafeDirect);
            }
            
            const assAction = evalAssassination(ctx);
            console.log("evalAssassination result:", JSON.stringify(assAction));
            
            const starAction = evalStarCollection(ctx);
            console.log("evalStarCollection result:", JSON.stringify(starAction));
        }
    }
}

runSimulation();
