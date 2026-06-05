const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const scratchDir = __dirname;

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        if (file.endsWith('.json') && !file.includes('package') && !file.includes('report')) {
            const filePath = path.join(dir, file);
            try {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                let match = content.match || (content.replayData && content.replayData.match);
                let summary = content.summary || (content.replayData && content.replayData.summary);
                let meta = content.meta || (content.replayData && content.replayData.meta) || content.replayMeta;
                
                if (match && summary) {
                    console.log(`File: ${file}`);
                    console.log(`  Map ID: ${match.mapId || 'N/A'}`);
                    console.log(`  Map Name: ${match.mapName || 'N/A'}`);
                    console.log(`  Total Frames: ${summary.framesTotal || 'N/A'}`);
                    console.log(`  Winner: ${summary.result ? summary.result.winner : 'N/A'}`);
                    console.log(`  Reason: ${match.resultReason || (summary.result ? summary.result.reason : 'N/A')}`);
                }
            } catch (e) {
                // Ignore parsing errors for non-replay JSON files
            }
        }
    });
}

console.log("--- Scanning Root Directory ---");
scanDir(rootDir);
console.log("\n--- Scanning Scratch Directory ---");
scanDir(scratchDir);
