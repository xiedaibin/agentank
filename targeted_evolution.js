const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

async function main() {
    const targetId = process.argv[2];
    if (!targetId) {
        console.log("用法: node targeted_evolution.js <tank_id>");
        return;
    }

    console.log(`\n🚀 启动针对目标 [${targetId}] 的专项进化流程...`);

    // 第一阶段：数据采集 (挑战 10 场)
    console.log(`\n[阶段 1] 正在采集对阵 ${targetId} 的样本数据...`);
    try {
        execSync(`node challenge_target.js ${targetId}`, { stdio: 'inherit' });
    } catch (e) {
        console.error("采集失败:", e.message);
    }

    // 第二阶段：代码迭代 (由 AI 在对话中完成，这里执行回归测试)
    console.log(`\n[阶段 2] 样本采集完成。请 AI 分析录像并更新 new_tank.js...`);
    // 注意：实际的代码编写动作由 Agent 在本 Turn 内完成
    
    // 第三阶段：验证与回归
    console.log(`\n[阶段 3] 启动全自动回归测试...`);
    try {
        // 自动提取日志中的基准进行回归
        execSync(`node batch_evolution.js auto "针对 ${targetId} 的专项优化"`, { stdio: 'inherit' });
    } catch (e) {
        console.error("回归测试失败:", e.message);
    }
}

main();
