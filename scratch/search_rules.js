const fs = require('fs');
const path = require('path');

const files = ['AGENT_GUIDE.md', 'MULTIPLAYER-AGENT-GUIDE.md', 'AGENTS.md', 'STRATEGY.md'];
const keywords = [/frame/i, /limit/i, /time/i, /draw/i, /结束/i, /上限/i, /总帧/i, /帧数/i, /duration/i, /max/i];

files.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${file}`);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log(`\n=== Matches in ${file} ===`);
    lines.forEach((line, index) => {
        const matches = keywords.some(kw => kw.test(line));
        if (matches) {
            console.log(`${index + 1}: ${line.trim()}`);
        }
    });
});
