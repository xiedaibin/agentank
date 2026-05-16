const fs = require('fs');
const path = require('path');

const replayDir = process.argv[2] || 'targeted_evolution_replays';

function analyze() {
    if (!fs.existsSync(replayDir)) return;
    const files = fs.readdirSync(replayDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) return;

    console.log(`\n=== 深度策略分析报告 (共 ${files.length} 局败战) ===\n`);

    const stats = { freezeDeaths: 0, bulletDeaths: 0, starLosses: 0, other: 0 };

    files.forEach(file => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(replayDir, file), 'utf8'));
            const reason = data.match.resultReason;
            const records = data.replayData.replay.records;
            const lastFrame = records[records.length - 1];
            
            let isFreezeInvolved = false;
            let deathFrame = records.length;
            
            // 检查死亡前 10 帧是否有 freeze
            const searchWindow = records.slice(Math.max(0, records.length - 10));
            searchWindow.forEach(f => {
                if (f.some(a => a.type === 'skill' && a.skillType === 'freeze' && a.by === 1)) {
                    isFreezeInvolved = true;
                }
            });

            let contradiction = "";
            if (reason === 'crashed') {
                if (isFreezeInvolved) {
                    stats.freezeDeaths++;
                    contradiction = "冰冻必杀 (Freeze Combo)";
                } else {
                    stats.bulletDeaths++;
                    contradiction = "物理击杀 (Bullet Hit)";
                }
            } else if (reason === 'star') {
                stats.starLosses++;
                contradiction = "星星落后 (Star Lead Loss)";
            } else {
                stats.other++;
                contradiction = "其他 (" + reason + ")";
            }

            console.log(`[${file}] ${contradiction} | 帧数: ${records.length}`);
        } catch (e) {}
    });

    console.log("\n--- 汇总统计 ---");
    console.log(`- 冰冻必杀: ${stats.freezeDeaths}`);
    console.log(`- 物理击杀: ${stats.bulletDeaths}`);
    console.log(`- 星星落后: ${stats.starLosses}`);
    console.log(`- 其他原因: ${stats.other}`);
    console.log('----------------\n');
}

analyze();
