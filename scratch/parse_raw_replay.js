const fs = require('fs');
const data = JSON.parse(fs.readFileSync('replays/mat_CIAst2yusxsIhmLDI.json', 'utf8'));
console.log("Keys:", Object.keys(data));
if (data.replayData) {
    console.log("replayData keys:", Object.keys(data.replayData));
    if (data.replayData.replay) {
        console.log("replay keys:", Object.keys(data.replayData.replay));
        const records = data.replayData.replay.records;
        console.log("Records length:", records.length);
        console.log("Record[0]:", JSON.stringify(records[0]));
        console.log("Record[1]:", JSON.stringify(records[1]));
        console.log("Record[2]:", JSON.stringify(records[2]));
        // 查找 speak 喊话
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            // 看看里面有什么
        }
    }
}
