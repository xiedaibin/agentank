const fs = require('fs');
const path = require('path');

function getToken() {
    // 1. 优先从环境变量中获取（如在 CI/CD 或终端执行了 export/set）
    if (process.env.AGENTANK_TOKEN) {
        return process.env.AGENTANK_TOKEN.trim();
    }
    
    // 2. 原生解析本地 .env 文件（向上查找最多3层，支持在子目录如 scratch/ 运行的脚本）
    let currentDir = __dirname;
    for (let i = 0; i < 3; i++) {
        const envPath = path.join(currentDir, '.env');
        if (fs.existsSync(envPath)) {
            try {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const match = envContent.match(/AGENTANK_TOKEN\s*=\s*['"]?([a-zA-Z0-9_]+)['"]?/);
                if (match && match[1]) {
                    return match[1].trim();
                }
            } catch (e) {
                // 忽略读取错误
            }
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break;
        currentDir = parentDir;
    }
    
    return '';
}

module.exports = {
    getToken
};
