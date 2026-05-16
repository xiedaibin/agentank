const fs = require('fs');
const path = require('path');

const replayDir = 'rank_replays';

function summarize() {
    if (!fs.existsSync(replayDir)) {
        console.log("Error: rank_replays directory not found.");
        return;
    }

    const files = fs.readdirSync(replayDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.log("No replays found in rank_replays.");
        return;
    }

    const summary = {
        totalLosses: files.length,
        cases: []
    };

    files.forEach(file => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(replayDir, file), 'utf8'));
            const replay = data.replayData?.replay || data.replay;
            if (!replay) return;

            const records = replay.records || [];
            if (records.length === 0) return;

            const lastFrame = records[records.length - 1];
            const firstFrame = records[0];

            // Identify me and enemy
            const challenger = data.participants.challenger;
            const defender = data.participants.defender;
            const isChallenger = challenger.tankName === 'XDB' || challenger.tankId === 230;
            
            // Find tank object IDs from frame 1 (usually where they move first)
            const frame1 = records[1] || [];
            const tankActions = frame1.filter(a => a.type === 'tank' && a.action === 'go');
            // This is a bit heuristic, might need better way to link objectId to participant
            
            let deathReason = 'Timeout/Other';
            
            // Look for crash/destroy in last few frames
            for (let i = records.length - 1; i >= Math.max(0, records.length - 5); i--) {
                const frame = records[i];
                const tankCrash = frame.find(a => a.type === 'tank' && (a.action === 'crashed' || a.action === 'destroyed'));
                if (tankCrash) {
                    deathReason = 'Killed';
                    break;
                }
            }

            summary.cases.push({
                filename: file,
                duration: records.length,
                enemyName: isChallenger ? defender.tankName : challenger.tankName,
                deathReason: deathReason
            });
        } catch (e) {
            console.error(`Error processing ${file}: ${e.message}`);
        }
    });

    console.log(JSON.stringify(summary, null, 2));
}

summarize();
