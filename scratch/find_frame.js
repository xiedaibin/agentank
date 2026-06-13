const fs = require('fs');
const path = require('path');

async function main() {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'mat_HR1tCuOe5bQI4VZb0_raw.json'), 'utf8'));
    const records = raw.replayData.replay.records || [];
    for (let f = 0; f < records.length; f++) {
        const events = records[f] || [];
        for (const ev of events) {
            if (ev.sourceObjectId === "ef63001a" && ev.skillType === "teleport") {
                console.log(`Frame ${f}: XDB cast teleport!`);
                console.log(JSON.stringify(events, null, 2));
            }
        }
    }
}

main();
