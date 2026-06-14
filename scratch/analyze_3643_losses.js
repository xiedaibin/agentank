const fs = require('fs');
const path = require('path');

const replayDir = 'targeted_evolution_replays';

function analyze() {
    if (!fs.existsSync(replayDir)) {
        console.log("Error: targeted_evolution_replays directory not found.");
        return;
    }

    const files = fs.readdirSync(replayDir).filter(f => f.startsWith('loss_3643_') && f.endsWith('.json'));
    if (files.length === 0) {
        console.log("No Riftwalker 3643 replays found in targeted_evolution_replays.");
        return;
    }

    console.log(`Analyzing ${files.length} loss replays against 3643...`);

    files.forEach(file => {
        try {
            const content = fs.readFileSync(path.join(replayDir, file), 'utf8');
            const data = JSON.parse(content);
            const replay = data.replayData?.replay || data.replay;
            if (!replay) {
                console.log(`File ${file} has no replay data.`);
                return;
            }

            const records = replay.records || [];
            const meta = replay.meta || {};
            const result = meta.result || {};

            console.log(`\nMatch: ${file}`);
            console.log(`- Total Frames: ${records.length}`);
            console.log(`- Result Reason: ${data.match?.resultReason || result.reason}`);
            console.log(`- Winner: ${data.match?.winnerTankName || 'Riftwalker'}`);

            // 我们来还原整个过程
            // 在这个 raw 事件记录中，我们可以跟踪每个坦克的位置和状态
            let myPos = [2, 2]; // 默认起点
            let enemyPos = [16, 12]; // 默认起点
            let myDir = "up";
            let enemyDir = "down";
            
            // 查一下 participants 里面的初始位置
            const players = data.replayData?.map?.players || data.map?.players;
            if (players && players.length >= 2) {
                myPos = players[0].position.slice();
                myDir = players[0].direction;
                enemyPos = players[1].position.slice();
                enemyDir = players[1].direction;
            }

            // 我们需要收集并播放 records 事件
            let myDeathFrame = -1;
            let deathPos = null;
            let deathReason = "unknown";
            let speakLog = [];

            for (let f = 0; f < records.length; f++) {
                const events = records[f];
                if (!Array.isArray(events)) continue;

                events.forEach(evt => {
                    // 跟踪 XDB (objectId == 'e359a57c' 或者是 index 0，即 player index 0)
                    const isMe = evt.objectId === 'e359a57c' || evt.by === 0 || (evt.type === 'tank' && evt.objectId !== 'e7a2e02c');
                    const isEnemy = evt.objectId === 'e7a2e02c' || evt.by === 1 || (evt.type === 'tank' && evt.objectId === 'e7a2e02c');

                    if (evt.type === 'speech' && isMe) {
                        speakLog.push(`[F${f}] Speak: "${evt.text}" at ${JSON.stringify(evt.position)}`);
                    }

                    if (evt.type === 'tank') {
                        if (evt.action === 'go') {
                            if (isMe) myPos = evt.position.slice();
                            else enemyPos = evt.position.slice();
                        } else if (evt.action === 'turn') {
                            if (isMe) myDir = evt.direction;
                            else enemyDir = evt.direction;
                        }
                    } else if (evt.type === 'skill' && evt.action === 'applied') {
                        if (evt.skillType === 'teleport') {
                            if (isMe) {
                                myPos = evt.to.slice();
                                speakLog.push(`[F${f}] Teleport to ${JSON.stringify(myPos)}`);
                            } else {
                                enemyPos = evt.to.slice();
                                speakLog.push(`[F${f}] Enemy Teleport to ${JSON.stringify(enemyPos)}`);
                            }
                        }
                    } else if (evt.type === 'kill') {
                        // 死亡
                        if (evt.tankId === 230 || evt.objectId === 'e359a57c' || isMe) {
                            myDeathFrame = f;
                            deathPos = myPos.slice();
                            deathReason = "killed";
                        }
                    }
                });
            }

            console.log(`- Final Position: XDB ${JSON.stringify(myPos)}, Enemy ${JSON.stringify(enemyPos)}`);
            console.log(`- Last few actions / speaks:`);
            speakLog.slice(-10).forEach(log => console.log(`  ${log}`));

        } catch (e) {
            console.error(`Error analyzing ${file}:`, e);
        }
    });
}

analyze();
