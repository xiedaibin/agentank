// simulate/run.js
// 本地模拟器运行脚本与原生 HTTP 服务

const fs = require('fs');
const path = require('path');
const http = require('http');
const engine = require('./engine');

// 命令行参数提取
const challengerPath = process.argv[2];
const defenderPath = process.argv[3];
const mapId = process.argv[4] || 'classic';

if (!challengerPath || !defenderPath) {
    console.log("Usage: node simulate/run.js <ChallengerCodePath> <DefenderCodePath> [MapID]");
    console.log("Example: node simulate/run.js ./new_tank.js ./new_tank.js classic");
    process.exit(1);
}

// 加载双方 JS 代码
let challengerCode, defenderCode;
try {
    challengerCode = fs.readFileSync(path.resolve(challengerPath), 'utf8');
} catch (err) {
    console.error(`Failed to read challenger code at ${challengerPath}:`, err.message);
    process.exit(1);
}

try {
    defenderCode = fs.readFileSync(path.resolve(defenderPath), 'utf8');
} catch (err) {
    console.error(`Failed to read defender code at ${defenderPath}:`, err.message);
    process.exit(1);
}

console.log(`[Simulator] Loaded:`);
console.log(`  - Challenger : ${challengerPath}`);
console.log(`  - Defender   : ${defenderPath}`);
console.log(`  - Map        : ${mapId}`);
console.log(`[Simulator] Simulating match...`);

// 执行物理引擎，运行战斗
let replayData;
try {
    replayData = engine.runSimulation(challengerCode, defenderCode, mapId);
} catch (err) {
    console.error("Simulation crashed during execution:", err.stack || err.message);
    process.exit(1);
}

// 写入本地 Replay 文件
const replayFile = path.join(__dirname, 'local_replay.json');
try {
    fs.writeFileSync(replayFile, JSON.stringify(replayData, null, 2), 'utf8');
    console.log(`[Simulator] Match completed! Replay saved to ${replayFile}`);
    console.log(`  - Total Frames : ${replayData.replay.records.length}`);
    console.log(`  - Winner       : ${replayData.replay.meta.result.winner === 0 ? 'Challenger' : (replayData.replay.meta.result.winner === 1 ? 'Defender' : 'Draw')}`);
    console.log(`  - Reason       : ${replayData.replay.meta.result.reason}`);
} catch (err) {
    console.error("Failed to write local_replay.json:", err.message);
    process.exit(1);
}

// 启动原生 HTTP 服务（不需要第三方依赖包，确保开箱即用）
const PORT = 3000;
const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'viewer.html' : req.url);

    // 安全防御，防目录穿越
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Access Denied');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found - 文件未找到');
            return;
        }

        // 识别 Content-Type
        let ext = path.extname(filePath);
        let contentType = 'text/plain; charset=utf-8';
        if (ext === '.html') contentType = 'text/html; charset=utf-8';
        else if (ext === '.json') contentType = 'application/json; charset=utf-8';
        else if (ext === '.js') contentType = 'application/javascript; charset=utf-8';
        else if (ext === '.css') contentType = 'text/css; charset=utf-8';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`  [Web Server] Local playback server is now running!`);
    console.log(`  👉 Please open: http://localhost:${PORT}/viewer.html`);
    console.log(`  (Press Ctrl+C to stop the server)`);
    console.log(`=============================================================\n`);
});
