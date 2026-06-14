const fs = require('fs');
const path = require('path');

const replayDir = 'batch_evolution_replays';

function summarize() {
    if (!fs.existsSync(replayDir)) {
        console.log("Error: batch_evolution_replays directory not found.");
        return;
    }

    const files = fs.readdirSync(replayDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.log("No replays found in batch_evolution_replays.");
        return;
    }

    const summary = {
        totalLosses: files.length,
        cases: []
    };

    files.forEach(file => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(replayDir, file), 'utf8'));
            const match = data.match || {};
            const sum = data.summary || {};
            
            const challenger = data.participants?.challenger?.tankName;
            const defender = data.participants?.defender?.tankName;
            const enemyName = challenger === 'XDB' ? defender : challenger;
            
            const myStats = sum.tanks?.XDB || {};
            const enemyStats = sum.tanks?.[enemyName] || {};

            summary.cases.push({
                filename: file,
                matchId: match.urlId,
                winner: match.winnerTankName,
                reason: match.resultReason,
                duration: sum.framesTotal,
                myStars: myStats.stars,
                enemyStars: enemyStats.stars,
                myDiagnosis: myStats.diagnosis,
                enemyDiagnosis: enemyStats.diagnosis
            });
        } catch (e) {
            console.error(`Error processing ${file}: ${e.message}`);
        }
    });

    console.log(JSON.stringify(summary, null, 2));
}

summarize();
