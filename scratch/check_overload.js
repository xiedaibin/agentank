const fs = require('fs');
const path = require('path');

const replayDir = 'targeted_evolution_replays';
const files = fs.readdirSync(replayDir).filter(f => f.endsWith('.json'));

files.forEach(file => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(replayDir, file), 'utf8'));
        const records = data.replayData.replay.records;
        
        // Scan for bullet creation and movement
        for (let f = 0; f < records.length; f++) {
            const frameEvents = records[f];
            
            // Find if there was an overload cast/active, or if two bullets were created in the same frame
            const createdBullets = frameEvents.filter(e => e.action === 'created' && e.type === 'bullet');
            if (createdBullets.length === 2) {
                // This is an overload shot!
                const b1 = createdBullets[0];
                const b2 = createdBullets[1];
                const shooter = b1.tank;
                const dir = b1.direction;
                
                // Find where they moved in the next frames
                let p1 = null;
                let p2 = null;
                
                // Let's trace their first movement positions
                for (let f2 = f; f2 < Math.min(f + 3, records.length); f2++) {
                    const events = records[f2];
                    events.forEach(ev => {
                        if (ev.type === 'bullet' && ev.action === 'go') {
                            if (ev.objectId === b1.objectId && !p1) p1 = ev.position;
                            if (ev.objectId === b2.objectId && !p2) p2 = ev.position;
                        }
                    });
                }
                
                console.log(`File: ${file} | Frame: ${f}`);
                console.log(`  Shooter Pos: [${shooter.position}] Dir: ${shooter.direction}`);
                console.log(`  Bullet 1 first pos: [${p1}]`);
                console.log(`  Bullet 2 first pos: [${p2}]`);
            }
        }
    } catch (e) {
        console.error(e);
    }
});
