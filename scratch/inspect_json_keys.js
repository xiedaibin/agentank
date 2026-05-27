const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scratch/sim_result.json', 'utf8'));

console.log("Root keys:", Object.keys(data));
if (data.replayData) {
    console.log("replayData keys:", Object.keys(data.replayData));
    if (data.replayData.replay) {
        console.log("replay keys:", Object.keys(data.replayData.replay));
        if (data.replayData.replay.meta) {
            console.log("replay.meta keys:", Object.keys(data.replayData.replay.meta));
        }
    }
}
