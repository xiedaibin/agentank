const fs = require('fs');
const path = require('path');

const replayDir = 'targeted_evolution_replays';

function summarize() {
    if (!fs.existsSync(replayDir)) {
        console.log("Error: targeted_evolution_replays directory not found.");
        return;
    }

    const files = fs.readdirSync(replayDir).filter(f => f.startsWith('loss_random_') && f.endsWith('.json'));
    if (files.length === 0) {
        console.log("No random losses found.");
        return;
    }

    console.log(`Analyzing ${files.length} random losses...`);

    files.forEach(file => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(replayDir, file), 'utf8'));
            const challenger = data.participants.challenger;
            const defender = data.participants.defender;
            const isChallengerMe = challenger.tankId === 230 || challenger.tankName === 'XDB';
            
            if (files.indexOf(file) === 0) {
                console.log("Root Keys:", Object.keys(data));
                console.log("Match Keys:", Object.keys(data.match));
                console.log("Summary Keys:", Object.keys(data.summary));
                console.log("Match object:", JSON.stringify(data.match, null, 2));
                console.log("Summary object:", JSON.stringify(data.summary, null, 2));
            }
            const enemy = isChallengerMe ? defender : challenger;
            const replay = data.replayData?.replay || data.replay;
            let enemySkill = "unknown";
            if (replay && replay.meta && replay.meta.players) {
                const players = replay.meta.players;
                const enemyIdx = isChallengerMe ? 1 : 0;
                if (players[enemyIdx] && players[enemyIdx].tank) {
                    enemySkill = players[enemyIdx].tank.skillType || players[enemyIdx].tank.skill?.type || "unknown";
                }
            }

            console.log(`- File: ${file}`);
            console.log(`  Enemy Name: ${enemy.tankName} (ID: ${enemy.tankId})`);
            console.log(`  Enemy Skill: ${enemySkill}`);
            console.log(`  Winner: ${data.match?.winnerTankName || data.summary?.result?.winner || "unknown"}`);
            console.log(`  Reason: ${data.match?.resultReason || data.summary?.result?.reason || "unknown"}`);
            
            // Check if there are any error stack traces in logs
            if (replay && replay.meta && replay.meta.err) {
                console.log(`  Replay Meta Error:`, replay.meta.err);
            }
        } catch (e) {
            console.error(`Error processing ${file}: ${e.message}`);
        }
    });
}

summarize();
