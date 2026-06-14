const fs = require('fs');
const path = require('path');

const replayDir = 'targeted_evolution_replays';

function analyze() {
    if (!fs.existsSync(replayDir)) {
        console.log("Error: targeted_evolution_replays directory not found.");
        return;
    }

    const files = fs.readdirSync(replayDir).filter(f => f.startsWith('loss_3773_') && f.endsWith('.json'));
    if (files.length === 0) {
        console.log("No 3773 losses found.");
        return;
    }

    console.log(`Analyzing ${files.length} 3773 losses...\n`);

    files.forEach(file => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(replayDir, file), 'utf8'));
            const challenger = data.participants.challenger;
            const defender = data.participants.defender;
            const isChallengerMe = challenger.tankId === 230 || challenger.tankName === 'XDB';
            
            const replay = data.replayData?.replay || data.replay;
            if (!replay) return;

            const records = replay.records || [];
            
            const myIndex = isChallengerMe ? 0 : 1;
            const enemyIndex = isChallengerMe ? 1 : 0;
            const meId = replay.meta.players[myIndex].tank.id;
            const enemyId = replay.meta.players[enemyIndex].tank.id;

            console.log(`==========================================`);
            console.log(`File: ${file}`);
            console.log(`Total Frames: ${records.length}`);
            console.log(`Winner: ${data.match?.winnerTankName || data.summary?.winner || "unknown"}`);
            
            // 追踪所有 speech 喊话和关键动作
            let XdbSpeaks = [];
            for (let f = 0; f < records.length; f++) {
                const events = records[f];
                events.forEach(ev => {
                    if (ev.type === 'speech' && ev.objectId === meId) {
                        XdbSpeaks.push(`[F${f}] ${ev.text}`);
                    }
                });
            }
            console.log("XDB Speaks:");
            console.log(XdbSpeaks.join(' -> ') || "None");

            // 打印最后 5 帧的参与者状态（坐标、朝向、血量等）
            console.log("\nLast 5 Frames Status:");
            for (let f = Math.max(0, records.length - 5); f < records.length; f++) {
                const events = records[f];
                let myPos = null, myDir = null;
                let enemyPos = null, enemyDir = null;
                let bulletEvents = [];

                // 还原当前帧的位置
                for (let i = 0; i <= f; i++) {
                    records[i].forEach(ev => {
                        if (ev.type === 'tank') {
                            if (ev.objectId === meId) {
                                if (ev.position) myPos = ev.position;
                                if (ev.direction) myDir = ev.direction;
                            }
                            if (ev.objectId === enemyId) {
                                if (ev.position) enemyPos = ev.position;
                                if (ev.direction) enemyDir = ev.direction;
                            }
                        }
                        if (ev.type === 'skill' && ev.sourceObjectId === enemyId && ev.action === 'applied') {
                            if (ev.to) enemyPos = ev.to;
                        }
                        if (ev.type === 'skill' && ev.sourceObjectId === meId && ev.action === 'applied') {
                            if (ev.to) myPos = ev.to;
                        }
                    });
                }

                events.forEach(ev => {
                    if (ev.type === 'bullet') {
                        bulletEvents.push(ev);
                    }
                });

                console.log(`  [Frame ${f}]`);
                console.log(`    XDB: ${JSON.stringify(myPos)} dir: ${myDir}`);
                console.log(`    Agro: ${JSON.stringify(enemyPos)} dir: ${enemyDir}`);
                if (bulletEvents.length > 0) {
                    console.log(`    Bullets: ${JSON.stringify(bulletEvents)}`);
                }
                
                // 打印这一帧的行动
                const actions = events.filter(ev => ev.sourceObjectId === meId && (ev.type === 'move' || ev.type === 'turn' || ev.type === 'fire' || ev.type === 'skill'));
                if (actions.length > 0) {
                    console.log(`    XDB Actions: ${JSON.stringify(actions)}`);
                }
            }
            console.log(`==========================================\n`);

        } catch (e) {
            console.error(`Error processing ${file}: ${e.message}`);
        }
    });
}

analyze();
