const fs = require('fs');
const content = fs.readFileSync('new_tank.js', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('isEnemyOverloadActive')) {
        console.log(`${i + 1}: ${lines[i].trim()}`);
    }
}
