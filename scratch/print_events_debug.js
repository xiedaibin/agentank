const fs = require('fs');
const data = JSON.parse(fs.readFileSync('targeted_evolution_replays/loss_3773_mat_KJKyDnrEZWRLRFitD.json', 'utf8'));
const records = data.replayData?.replay?.records || data.replay?.records || [];
console.log("Records length:", records.length);
for (let f = 0; f < records.length; f++) {
    const events = records[f];
    events.forEach(ev => {
        if (ev.type !== 'tank' && ev.type !== 'bullet') {
            console.log(`[Frame ${f}] Type: ${ev.type}`, JSON.stringify(ev));
        }
    });
}
