const fs = require('fs');
const path = require('path');

const dirs = ['batch_evolution_replays', 'targeted_evolution_replays', 'rank_replays'];
const root = path.join(__dirname, '..');

dirs.forEach(d => {
    const dirPath = path.join(root, d);
    if (!fs.existsSync(dirPath)) {
        console.log(`Directory not found: ${d}`);
        return;
    }
    
    console.log(`\n--- Scanning Directory: ${d} ---`);
    const files = fs.readdirSync(dirPath);
    console.log(`Found ${files.length} files.`);
    
    let count = 0;
    files.forEach(file => {
        if (file.endsWith('.json')) {
            const filePath = path.join(dirPath, file);
            try {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                let match = content.match || (content.replayData && content.replayData.match);
                let summary = content.summary || (content.replayData && content.replayData.summary);
                
                if (match && summary) {
                    count++;
                    if (count <= 10 || match.resultReason === 'star') {
                        console.log(`  File: ${file}`);
                        console.log(`    Map: ${match.mapId}`);
                        console.log(`    Reason: ${match.resultReason || (summary.result ? summary.result.reason : 'N/A')}`);
                        console.log(`    Frames: ${summary.framesTotal}`);
                    }
                }
            } catch (e) {
                // ignore
            }
        }
    });
    console.log(`Scanned ${count} replay JSONs.`);
});
