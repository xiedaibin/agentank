const fs = require('fs');
const { getToken } = require('../config');

const token = getToken();
if (!token) {
    console.error("Token not found.");
    process.exit(1);
}

const run = async () => {
    let wins = 0;
    for (let i = 1; i <= 10; i++) {
        process.stdout.write(`[ \${i} / 10 ] ... `);
        try {
            const res = await fetch('https://agentank.ai/api/agent/tank/challenge', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ opponentTankId: 4754, mapId: 'classic' })
            });
            const data = await res.json();
            const isWin = data.winner === 'me' || data.winnerTankId === 230 || data.winnerTankName === 'XDB' || data.winner === 'XDB' || data.winner === 230;
            if (isWin) {
                wins++;
                console.log('WIN');
            } else {
                console.log('LOSS (Replay: ' + data.urlId + ')');
            }
        } catch (e) {
            console.log('Error: ' + e.message);
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    console.log(`\nFinal Win Rate: \${(wins/10*100).toFixed(2)}% (\${wins}/10)`);
};

run();
