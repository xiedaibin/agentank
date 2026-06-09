const fs = require('fs');
const code = fs.readFileSync('new_tank.js', 'utf8');
const lines = code.split('\n');
lines.forEach((line, index) => {
    if (line.includes('canFire')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
