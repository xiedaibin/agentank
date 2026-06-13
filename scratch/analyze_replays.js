const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const token = getToken();
    const reportPath = path.join(__dirname, '../evolution_report.json');
    if (!fs.existsSync(reportPath)) {
        console.error("Error: evolution_report.json not found.");
        process.exit(1);
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const matches = report.matches || [];

    console.log(`[分析] 从 evolution_report.json 发现共 ${matches.length} 场对局。开始下载事件流分析守星(Guard)和吃星延迟(Delay)触发情况...`);

    let triggeredCount = 0;

    for (const match of matches) {
        const urlId = match.matchUrlId;
        const opponent = match.opponent;
        const result = match.result;

        try {
            const res = await fetch(`https://agentank.ai/api/matches/${urlId}/agent.json?view=events`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                console.log(`❌ [对局 ${match.matchNum}] 无法获取 ${urlId} 的事件数据 (HTTP ${res.status})`);
                continue;
            }
            const eventData = await res.json();
            const events = eventData.events || [];
            
            let guardFires = [];
            let guardRuns = [];
            let guardTurns = [];
            let delayWaits = [];
            let delayTurns = [];

            for (const ev of events) {
                if (ev.event === "speak" && ev.tankId === 230) {
                    const text = ev.text || "";
                    if (text.includes("Guard Fire")) guardFires.push(ev.frame);
                    if (text.includes("Guard Run")) guardRuns.push(ev.frame);
                    if (text.includes("Guard Turn")) guardTurns.push(ev.frame);
                    if (text.includes("Delay Wait")) delayWaits.push(ev.frame);
                    if (text.includes("Delay Turn")) delayTurns.push(ev.frame);
                }
            }

            if (guardFires.length > 0 || guardRuns.length > 0 || guardTurns.length > 0 || delayWaits.length > 0 || delayTurns.length > 0) {
                triggeredCount++;
                console.log(`\n🎉 [对局 ${match.matchNum}] (${result.toUpperCase()}) ${urlId} (对手: ${opponent}) 触发策略：`);
                if (guardFires.length > 0) console.log(`   - [Guard Fire] 触发帧: ${guardFires.join(', ')}`);
                if (guardTurns.length > 0) console.log(`   - [Guard Turn] 触发帧: ${guardTurns.join(', ')}`);
                if (guardRuns.length > 0) console.log(`   - [Guard Run] 触发帧: ${guardRuns.join(', ')}`);
                if (delayWaits.length > 0) console.log(`   - [Delay Wait] 触发帧: ${delayWaits.join(', ')}`);
                if (delayTurns.length > 0) console.log(`   - [Delay Turn] 触发帧: ${delayTurns.join(', ')}`);
            } else {
                console.log(`➖ [对局 ${match.matchNum}] (${result.toUpperCase()}) ${urlId} (对手: ${opponent}) 未触发。`);
            }
        } catch (e) {
            console.log(`❌ [对局 ${match.matchNum}] 获取 ${urlId} 数据出错: ${e.message}`);
        }
        await delay(2000); // 避免频繁请求 API
    }

    console.log(`\n=== 统计报告 ===`);
    console.log(`总分析对局数: ${matches.length}`);
    console.log(`触发策略对局数: ${triggeredCount}`);
}

main();
