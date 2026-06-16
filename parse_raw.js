const fs = require('fs');
const data = JSON.parse(fs.readFileSync('raw_mat_1y9AXTiOcKo3OLhxE.json', 'utf8'));
const records = data.replayData.replay.records;

console.log("=== Match Detail Frame 60-70 ===");
for (let i = 60; i <= 70; i++) {
    console.log(`\n--- Frame ${i} ---`);
    console.log(JSON.stringify(records[i], null, 2));
}
