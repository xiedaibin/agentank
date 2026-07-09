const fs = require('fs');
const path = require('path');
const { getToken } = require('./config');

async function main() {
    const sourceFile = 'new_tank.js';
    const distFile = 'dist_tank.js';

    if (!fs.existsSync(sourceFile)) {
        console.error(`Error: Source file '${sourceFile}' not found.`);
        process.exit(1);
    }

    console.log(`[Compiler] Compiling '${sourceFile}' for production...`);
    let code = fs.readFileSync(sourceFile, 'utf8');

    // 1. 去除所有 me.speak(...) 及其内部的各种喊话内容
    // 匹配 me.speak("...") 或 me.speak('...') 或含有加号的 me.speak(...) 语句，连同末尾分号一并抹除
    code = code.replace(/(ctx\.)?me\.speak\([^;]*\);?/g, '');

    // 2. 去除所有多行注释 /* ... */
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');

    // 3. 去除所有单行注释 // ... 并按行整理
    code = code.split('\n').map(line => {
        // 简单去除双斜杠后面的注释，但要保留代码本身的结构
        // 为防误杀，只要不是在字符串中，直接切除 //
        // 我们的坦克代码中不含 URL，可安全切除 // 注释
        const index = line.indexOf('//');
        if (index !== -1) {
            line = line.substring(0, index);
        }
        return line.trimEnd(); // 保留前导空格，维持基本代码块结构，方便在 dist 中必要时进行基础排错
    }).filter(line => line.trim().length > 0).join('\n');

    // 4. 将压缩清理后的干净代码写入本地 dist_tank.js 备查
    fs.writeFileSync(distFile, code);
    console.log(`[Compiler] Production build completed. Saved to '${distFile}' (${Buffer.byteLength(code, 'utf8')} bytes).`);

    // 5. 读取 Token 准备发布
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }

    // 提取版本号和简短注释用于发布说明
    const firstLine = code.split('\n')[0] || '';
    const notes = `Adopted Build (Clean Edition - No Speak, No Comments) | ${firstLine.substring(0, 100)}`;

    console.log("[Publisher] Uploading cleaned build to AgenTank platform...");
    const res = await fetch('https://agentank.ai/api/agent/tank/code', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            notes: notes,
            submittedBy: "Gemini Compiler"
        })
    });

    if (!res.ok) {
        console.error("[Publisher] Publish failed:", await res.text());
        return;
    }
    const result = await res.json();
    console.log("[Publisher] Publish success!", result);

    console.log("[Publisher] Waiting 2 seconds for simulation cooldown...");
    await new Promise(r => setTimeout(r, 2000));

    console.log("[Publisher] Challenging random eligible opponent...");
    const challengeRes = await fetch('https://agentank.ai/api/agent/tank/challenge', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            randomOpponent: true,
            mapId: 'classic'
        })
    });

    if (!challengeRes.ok) {
        console.error("[Publisher] Challenge failed:", await challengeRes.text());
        return;
    }
    const matchData = await challengeRes.json();
    console.log("[Publisher] Challenge success!");
    console.log("Match URL: https://agentank.ai/history/" + matchData.matchUrlId);
    console.log("Winner:", matchData.winner);
    console.log("Reason:", matchData.reason);
}

main();
