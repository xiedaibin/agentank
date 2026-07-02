const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '../new_tank.js'), 'utf8');

// Find all matches of "function findAssassinSpot"
let index = 0;
let pos = code.indexOf("function findAssassinSpot");
while (pos !== -1) {
    console.log(`Found "function findAssassinSpot" at character ${pos}`);
    // Print 50 lines from this position
    const lines = code.substring(pos, pos + 2000);
    console.log("------------------- Snippet -------------------");
    console.log(lines.substring(0, 1000));
    console.log("-----------------------------------------------");
    index++;
    pos = code.indexOf("function findAssassinSpot", pos + 1);
}

console.log(`Total found: ${index}`);
