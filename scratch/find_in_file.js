const fs = require('fs');
const filepath = process.argv[2];
const keyword = process.argv[3];

if (!filepath || !keyword) {
    console.log("Usage: node find_in_file.js <filepath> <keyword>");
    process.exit(1);
}

const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

console.log(`Searching in ${filepath} for: ${keyword}`);
lines.forEach((line, index) => {
    if (line.includes(keyword)) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
