const fs = require('fs');

function analyzeFile(filePath) {
    console.log(`\n==================== Analyzing ${filePath} ====================`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const replay = data.replayData?.replay || data.replay;
    if (!replay) {
        console.log("No replay data found.");
        return;
    }
    const records = replay.records || [];
    console.log(`Total Frames: ${records.length}`);

    // Identify participants
    const challenger = data.participants.challenger;
    const defender = data.participants.defender;
    const isChallengerMe = challenger.tankId === 230 || challenger.tankName === 'XDB';
    const meName = isChallengerMe ? challenger.tankName : defender.tankName;
    const enemyName = isChallengerMe ? defender.tankName : challenger.tankName;

    const myIndex = isChallengerMe ? 0 : 1;
    const enemyIndex = isChallengerMe ? 1 : 0;

    const myTankId = replay.meta.players[myIndex].tank.id;
    const enemyTankId = replay.meta.players[enemyIndex].tank.id;

    console.log(`Me: ${meName} (PlayerIndex: ${myIndex}, Object ID: ${myTankId})`);
    console.log(`Enemy: ${enemyName} (PlayerIndex: ${enemyIndex}, Object ID: ${enemyTankId})`);

    records.forEach((frame, idx) => {
        let output = `Frame ${idx}: `;
        let hasEvent = false;

        frame.forEach(a => {
            if (a.type === 'star') {
                output += `[Star ${a.action} at ${JSON.stringify(a.position)}] `;
                hasEvent = true;
            } else if (a.type === 'speech') {
                const who = a.objectId === myTankId ? 'Me' : 'Enemy';
                output += `${who} speak: "${a.text}" | `;
                hasEvent = true;
            } else if (a.type === 'tank') {
                const who = a.objectId === myTankId ? 'Me' : 'Enemy';
                if (a.action === 'go') output += `${who}: move to ${JSON.stringify(a.position)} | `;
                else if (a.action === 'turn') output += `${who}: turn ${a.direction} | `;
                else if (a.action === 'crashed') {
                    const victim = a.objectId === myTankId ? 'Me' : 'Enemy';
                    output += `${victim} CRASHED (by Player ${a.by}) | `;
                }
                hasEvent = true;
            } else if (a.type === 'skill') {
                const who = a.sourceObjectId === myTankId ? 'Me' : 'Enemy';
                if (a.action === 'cast') output += `${who} CAST skill | `;
                else if (a.action === 'applied') output += `${who} TELEPORT to ${JSON.stringify(a.to)} | `;
                hasEvent = true;
            } else if (a.type === 'bullet') {
                const who = a.tank?.id === myTankId ? 'Me' : 'Enemy';
                output += `${who}'s Bullet ${a.action} at ${JSON.stringify(a.position)} dir ${a.direction} | `;
                hasEvent = true;
            }
        });

        if (hasEvent) {
            console.log(output);
        }
    });
}

analyzeFile('targeted_evolution_replays/loss_3773_mat_2beILbeOfeQ7aJ8xb.json');
analyzeFile('targeted_evolution_replays/loss_3773_mat_7Hf5jLgz5sb1YjyR8.json');
