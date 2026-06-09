const fs = require('fs');
const content = fs.readFileSync('new_tank.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
    if (line.includes('me.bullet') || line.includes('activeBullets')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
