const fs = require('fs');
const path = require('path');

async function main() {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'mat_CempGXxxBdoKbGuhC_raw.json'), 'utf8'));
    const records = raw.replayData.replay.records || [];
    let meId = raw.replayData.replay.meta.players[1].tank.id; // Usually player 1 is defender XDB
    // We can auto-detect XDB's id
    const summary = JSON.parse(fs.readFileSync(path.join(__dirname, 'mat_CempGXxxBdoKbGuhC_summary.json'), 'utf8'));
    const defender = summary.participants.defender;
    const challenger = summary.participants.challenger;
    let xdbIndex = 0;
    if (defender.tankName === "XDB") {
        xdbIndex = 1;
    }
    meId = raw.replayData.replay.meta.players[xdbIndex].tank.id;
    console.log(`XDB ID: ${meId}, index: ${xdbIndex}`);

    for (let f = 0; f < records.length; f++) {
        const events = records[f] || [];
        for (const ev of events) {
            if (ev.objectId === meId && ev.type === "speech") {
                console.log(`Frame ${f}: XDB spoke: "${ev.text}"`);
            }
        }
    }
}

main();
