const fs = require('fs');
const path = require('path');

function main() {
    const rawPath = path.join(__dirname, 'mat_9qHT6UfYlQ3J9cj7z_raw.json');
    if (!fs.existsSync(rawPath)) {
        console.error("File not found:", rawPath);
        return;
    }
    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    const map = raw.replayData.map.map;
    
    console.log("Map around row 12:");
    // Print rows 10 to 14
    for (let y = 10; y <= 14; y++) {
        let rowStr = `Row ${y.toString().padStart(2)}: `;
        for (let x = 0; x < map.length; x++) {
            rowStr += map[x][y] + " ";
        }
        console.log(rowStr);
    }
}

main();
