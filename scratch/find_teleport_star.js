const fs = require('fs');
const path = require('path');

function main() {
    const rawPath = path.join(__dirname, 'mat_4Q4h7e1unh3AvTOVQ_raw.json');
    if (!fs.existsSync(rawPath)) {
        console.error("Replay raw not found:", rawPath);
        return;
    }
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    const records = raw.replayData.replay.records || [];
    const meta = raw.replayData.replay.meta || {};

    const p0 = meta.players[0];
    const p1 = meta.players[1];
    
    let xdbIndex = p0.tank.name === 'XDB' || p0.tank.id.includes('XDB') ? 0 : 1;
    // Let's identify by checking the winner or participants
    // Usually, XDB's style/name is in the participant metadata or summary
    console.log("Player 0:", p0.tank);
    console.log("Player 1:", p1.tank);

    // Let's scan all records for teleport events by either player
    for (let f = 0; f < records.length; f++) {
        const evs = records[f] || [];
        let hasTP = false;
        evs.forEach(ev => {
            if (ev.action === 'applied' && ev.skillType === 'teleport') {
                hasTP = true;
            }
        });

        if (hasTP) {
            console.log(`\n--- Teleport detected at Frame ${f} ---`);
            evs.forEach(ev => {
                console.log(JSON.stringify(ev, null, 2));
            });
            
            // Print status around this frame
            // Find star position at this frame
            let starPos = null;
            // Scan previous events to find star position
            for (let pf = f; pf >= 0; pf--) {
                const pevs = records[pf] || [];
                const starEv = pevs.find(e => e.type === 'star' && e.action === 'created');
                if (starEv) {
                    starPos = starEv.position;
                    break;
                }
            }
            console.log(`Active Star at Frame ${f}: ${JSON.stringify(starPos)}`);
        }
    }
}

main();
