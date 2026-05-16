const fs = require('fs');
const path = require('path');

const replayDir = 'batch_evolution_replays';

function summarize() {
    if (!fs.existsSync(replayDir)) {
        console.log("Error: batch_evolution_replays directory not found.");
        return;
    }

    const files = fs.readdirSync(replayDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.log("No replays found in batch_evolution_replays.");
        return;
    }

    const summary = {
        totalLosses: files.length,
        cases: []
    };

    files.forEach(file => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(replayDir, file), 'utf8'));
            const replay = data.replayData?.replay || data.replay;
            if (!replay) return;

            const records = replay.records || [];
            if (records.length === 0) return;

            const lastFrame = records[records.length - 1];
            const firstFrame = records[0];

            // 基础信息提取
            const meId = 230; // 假设 XDB ID 始终为 230，或者根据初始帧判断
            const myFinalState = lastFrame.tanks?.find(t => t.id === meId) || lastFrame.tanks?.[0];
            const enemyFinalState = lastFrame.tanks?.find(t => t.id !== meId) || lastFrame.tanks?.[1];

            summary.cases.push({
                filename: file,
                duration: records.length,
                myFinalPos: myFinalState?.pos,
                enemyFinalPos: enemyFinalState?.pos,
                enemySkills: enemyFinalState?.skills || [],
                deathReason: lastFrame.event === 'kill' ? 'Killed' : 'Timeout/Other',
                // 这里可以扩展更复杂的逻辑，比如检测死亡瞬间附近的子弹
            });
        } catch (e) {
            console.error(`Error processing ${file}: ${e.message}`);
        }
    });

    console.log(JSON.stringify(summary, null, 2));
}

summarize();
