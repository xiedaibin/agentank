// scratch/test_replay.js
// 用于检验 local_replay.json 导出的数据合法性

const fs = require('fs');
const path = require('path');

const replayPath = path.resolve(__dirname, '../simulate/local_replay.json');

console.log(`[Test] Reading replay data from: ${replayPath}`);

if (!fs.existsSync(replayPath)) {
    console.error(`[Error] Replay file does not exist!`);
    process.exit(1);
}

try {
    const rawData = fs.readFileSync(replayPath, 'utf8');
    const data = JSON.parse(rawData);

    // 1. 验证地图数据结构
    if (!data.map || !Array.isArray(data.map.map)) {
        throw new Error("Missing data.map.map structure");
    }
    console.log(`[OK] Map loaded successfully. Dimension: ${data.map.map.length}x${data.map.map[0].length}`);

    // 2. 验证元信息
    const meta = data.replay.meta;
    if (!meta || !Array.isArray(meta.players) || meta.players.length !== 2) {
        throw new Error("Invalid meta.players structure");
    }
    console.log(`[OK] Player names: ${data.names.join(' vs ')}`);
    console.log(`[OK] Match winner: ${meta.result.winner === 0 ? 'Challenger' : (meta.result.winner === 1 ? 'Defender' : 'Draw')} (Reason: ${meta.result.reason})`);

    // 3. 统计并验证事件日志
    const records = data.replay.records;
    if (!Array.isArray(records) || records.length === 0) {
        throw new Error("Replay records are empty!");
    }

    const eventCounts = {};
    let speakEvents = [];
    let runtimeErrors = [];

    records.forEach((frameEvents, frameIdx) => {
        if (!Array.isArray(frameEvents)) return;
        frameEvents.forEach(ev => {
            eventCounts[ev.event] = (eventCounts[ev.event] || 0) + 1;
            if (ev.event === "speak") {
                speakEvents.push(`[Frame ${frameIdx}] ${ev.tank}: ${ev.message}`);
            }
            if (ev.event === "crashed" && ev.by === "runtime_error") {
                runtimeErrors.push(`[Frame ${frameIdx}] ${ev.tank}: ${ev.error}`);
            }
        });
    });

    console.log(`[OK] Total playback frames: ${records.length}`);
    console.log(`[Event distribution]:`);
    Object.keys(eventCounts).forEach(evt => {
        console.log(`  - ${evt}: ${eventCounts[evt]} times`);
    });

    if (runtimeErrors.length > 0) {
        console.warn(`[Warning] Found runtime errors in match:`);
        runtimeErrors.forEach(err => console.warn(`  - ${err}`));
        process.exit(2);
    } else {
        console.log(`[OK] No runtime errors found!`);
    }

    if (speakEvents.length > 0) {
        console.log(`[OK] Speak (Speech) logs found! Samples:`);
        speakEvents.slice(0, 10).forEach(sp => console.log(`  - ${sp}`));
    } else {
        console.warn(`[Warning] No speak event was logged.`);
    }

    console.log(`\n🎉 [Pass] Replay data verification passed!`);
} catch (err) {
    console.error(`[Fail] Replay verification failed:`, err.message);
    process.exit(1);
}
