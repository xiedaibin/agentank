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
            const match = data.match || {};
            const sum = data.summary || {};
            const p = data.participants || {};
            const challenger = p.challenger || {};
            const defender = p.defender || {};
            const isChallenger = challenger.tankName === 'XDB' || challenger.tankId === 230;
            const enemyName = isChallenger ? defender.tankName : challenger.tankName;

            const myStats = isChallenger ? sum.tanks?.XDB : sum.tanks?.[challenger.tankName];
            const enemyStats = isChallenger ? sum.tanks?.[defender.tankName] : sum.tanks?.XDB;

            summary.cases.push({
                filename: file,
                matchId: match.urlId,
                winner: match.winnerTankName,
                reason: match.resultReason,
                duration: sum.framesTotal,
                myStars: myStats?.stars || 0,
                enemyStars: enemyStats?.stars || 0,
                myDiagnosis: myStats?.diagnosis || 'N/A',
                enemyDiagnosis: enemyStats?.diagnosis || 'N/A'
            });
        } catch (e) {
            console.error(`Error processing ${file}: ${e.message}`);
        }
    });

    console.log(JSON.stringify(summary, null, 2));
}

summarize();
