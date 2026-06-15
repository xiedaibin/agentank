const fs = require('fs');
const content = fs.readFileSync('AGENT_GUIDE.md', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('hidden') || lines[i].includes('vision') || lines[i].includes('visible') || lines[i].includes('sight')) {
        console.log(`${i + 1}: ${lines[i].trim()}`);
    }
}
