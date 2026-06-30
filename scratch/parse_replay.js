const fs = require('fs');

async function parse() {
    const rawData = JSON.parse(fs.readFileSync('scratch/mat_LlBgqKMekroHwcmvw_raw.json', 'utf8'));
    const replay = rawData.replayData || rawData;
    const map = replay.map ? replay.map.map : null;
    if (map) {
        console.log("Map Grid (Transposed for printing y downwards):");
        const w = map.length;
        const h = map[0].length;
        for (let y = 0; y < h; y++) {
            let row = "";
            for (let x = 0; x < w; x++) {
                row += map[x][y] + " ";
            }
            console.log(`${y.toString().padStart(2, ' ')}: ${row}`);
        }
        // 打印 x 坐标刻度
        let header = "    ";
        for (let x = 0; x < w; x++) header += (x % 10).toString() + " ";
        console.log(header);
    }
    
    const records = (replay.replay && replay.replay.records) || replay.records;
    if (!records) {
        console.log("No records found.");
        return;
    }
    
    const players = replay.replay.meta.players;
    const isChallengerMe = rawData.participants.challenger && rawData.participants.challenger.tankName === 'XDB';
    const meId = isChallengerMe ? players[0].tank.id : players[1].tank.id;
    const enemyId = isChallengerMe ? players[1].tank.id : players[0].tank.id;
    const meName = "XDB (我方)";
    const enemyName = isChallengerMe ? 
        (rawData.participants.defender ? `${rawData.participants.defender.tankName} (敌方)` : '敌方') : 
        (rawData.participants.challenger ? `${rawData.participants.challenger.tankName} (敌方)` : '敌方');
    
    console.log(`Dynamic Identifications:`);
    console.log(`  Me ID: ${meId} (${meName})`);
    console.log(`  Enemy ID: ${enemyId} (${enemyName})`);
    
    console.log("\nTimeline of Events:");
    for (let i = 0; i < records.length; i++) {
        const frameEvents = records[i];
        console.log(`\n--- Frame ${i} ---`);
        frameEvents.forEach(ev => {
            const actor = ev.objectId === meId ? meName : (ev.objectId === enemyId ? enemyName : ev.objectId);
            if (ev.type === 'tank') {
                if (ev.action === 'go') {
                    console.log(`  [Tank Move] ${actor} moved to [${ev.position}] (reverse: ${ev.reverse})`);
                } else if (ev.action === 'turn') {
                    console.log(`  [Tank Turn] ${actor} turned relative direction "${ev.direction}"`);
                } else if (ev.action === 'fire') {
                    console.log(`  [Tank Fire] ${actor} fired bullet at position [${ev.position}]`);
                } else if (ev.action === 'teleport') {
                    console.log(`  [Tank Teleport] ${actor} teleported to [${ev.position}]`);
                } else {
                    console.log(`  [Tank Action] ${actor} did ${ev.action} at ${ev.position}`);
                }
            } else if (ev.type === 'speech') {
                const speaker = ev.objectId === meId ? meName : enemyName;
                console.log(`  [Speak] ${speaker} said: "${ev.text}" at [${ev.position}]`);
            } else if (ev.type === 'bullet') {
                const isBulletFromMe = ev.by === (isChallengerMe ? 0 : 1);
                if (ev.action === 'created') {
                    console.log(`  [Bullet Created] from actor ${isBulletFromMe ? 'XDB' : '敌方'} at [${ev.position}] dir=${ev.direction}`);
                } else if (ev.action === 'crashed') {
                    console.log(`  [Bullet Crashed] at [${ev.position}] due to ${ev.reason}`);
                } else {
                    console.log(`  [Bullet Action] ${ev.action} at [${ev.position}]`);
                }
            } else if (ev.type === 'star') {
                console.log(`  [Star Event] ${ev.action} at [${ev.position}]`);
            } else {
                console.log(`  [Other Event] type=${ev.type} action=${ev.action} actor=${ev.objectId || ev.by} pos=${ev.position}`);
            }
        });
    }
}

parse().catch(console.error);
