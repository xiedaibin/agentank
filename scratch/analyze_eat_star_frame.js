const fs = require('fs');
const path = require('path');

const replayDir = 'batch_evolution_replays';
const files = fs.readdirSync(replayDir).filter(f => f.endsWith('.json'));

if (files.length === 0) {
    console.log("No replays found in batch_evolution_replays.");
    process.exit(0);
}

// Let's load the first file
const file = files[0];
console.log(`Analyzing file: ${file}`);
const data = JSON.parse(fs.readFileSync(path.join(replayDir, file), 'utf8'));
const records = data.replayData?.replay?.records || [];

console.log(`Total frames: ${records.length}`);

// Find all frames where a star was eaten, or where a tank's score changed
let lastStars = {};
records.forEach((frame, idx) => {
    // If there is a star eating event
    const me = frame.tanks?.find(t => t.id === 230);
    const starPos = frame.star;
    
    // Check if XDB (id 230) ate a star
    if (me) {
        if (lastStars[me.id] !== undefined && me.stars > lastStars[me.id]) {
            console.log(`\n--- XDB ATE A STAR on Frame ${idx} ---`);
            console.log(`XDB Position:`, me.pos, 'Direction:', me.dir, 'Stars:', me.stars);
            console.log(`Current star position on map:`, starPos);
            
            // Print the next 5 frames
            for (let f = idx; f <= Math.min(idx + 5, records.length - 1); f++) {
                const fme = records[f].tanks?.find(t => t.id === 230);
                const enemy = records[f].tanks?.find(t => t.id !== 230);
                console.log(`Frame ${f}:`);
                console.log(`  XDB: pos=${JSON.stringify(fme?.pos)}, dir=${fme?.dir}, action=${fme?.action}`);
                console.log(`  Enemy: pos=${JSON.stringify(enemy?.pos)}, dir=${enemy?.dir}, action=${enemy?.action}`);
                console.log(`  Star on map:`, records[f].star);
            }
        }
        lastStars[me.id] = me.stars;
    }
});
