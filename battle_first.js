const fs = require('fs');
const { getToken } = require('./config');

const logFile = 'battle_first.log';
// Clear the log file on startup
fs.writeFileSync(logFile, '');

function log(msg) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const line = `[${timestamp}] ${msg}`;
    console.log(msg);
    fs.appendFileSync(logFile, line + '\n');
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function fetchJson(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { raw: text };
        }
    }

    if (!res.ok) {
        const message = data && data.raw ? data.raw : text;
        throw new Error(`HTTP ${res.status}: ${message}`);
    }

    return data;
}

async function getTankContext(token) {
    return fetchJson('https://agentank.ai/api/agent/tank', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
}

function getScore(tankContext) {
    const score = tankContext && tankContext.tank && tankContext.tank.rankScore;
    return typeof score === 'number' ? score : 0;
}

function getRankPoints(tankContext) {
    const points = tankContext && tankContext.tank && tankContext.tank.rankPoints;
    return typeof points === 'number' ? points : 0;
}

function getRankDelta(matchData, myTankId) {
    if (!Array.isArray(matchData.rankChanges)) return null;

    const change = matchData.rankChanges.find(item => {
        return item && (item.tankId === myTankId || item.id === myTankId);
    });

    if (!change) return null;
    if (typeof change.delta === 'number') return change.delta;
    if (typeof change.rankScoreDelta === 'number') return change.rankScoreDelta;
    if (typeof change.scoreDelta === 'number') return change.scoreDelta;
    return null;
}

function formatDelta(delta) {
    if (delta === null || delta === undefined || Number.isNaN(delta)) return 'n/a';
    return `${delta >= 0 ? '+' : ''}${delta}`;
}

function uniqueSearchTerms() {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const digits = '0123456789'.split('');
    const extras = ['tank', 'debug', 'rank', 'bot', 'ai', 'king', '666', 'A', '战', '坦克', "光", "小"];
    return [...new Set([...letters, ...digits, ...extras])];
}

async function searchOpponents(token, query) {
    const encoded = encodeURIComponent(query);
    const data = await fetchJson(`https://agentank.ai/api/agent/opponents?q=${encoded}&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return Array.isArray(data.opponents) ? data.opponents : [];
}

async function discoverTopEligibleOpponents(token, myTankId) {
    const byId = new Map();

    for (const query of uniqueSearchTerms()) {
        try {
            const opponents = await searchOpponents(token, query);
            for (const opponent of opponents) {
                if (!opponent || opponent.id === myTankId) continue;
                byId.set(opponent.id, opponent);
            }
        } catch (e) {
            // Ignore search errors to avoid crashing
        }
    }

    return [...byId.values()].sort((a, b) => {
        return (b.rankScore || 0) - (a.rankScore || 0);
    });
}

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }
    const cooldownMs = 5000;
    let myTankId = 230;
    let previousScore = 0;
    let previousRankPoints = 0;
    let targetOpponent = null;
    let matchCount = 0;

    log('=== 挂机第一模式启动 ===');
    log('正在初始化坦克数据...');

    try {
        const tankContext = await getTankContext(token);
        myTankId = tankContext.tank && tankContext.tank.id ? tankContext.tank.id : myTankId;
        previousScore = getScore(tankContext);
        previousRankPoints = getRankPoints(tankContext);
        log(`我的坦克 ID: ${myTankId} | 当前分数: ${previousScore} | 当前点数: ${previousRankPoints}`);
    } catch (e) {
        log(`[警告] 初始化获取坦克数据失败，将使用默认配置: ${e.message}`);
    }

    // Infinite loop
    while (true) {
        matchCount++;

        // Refresh/Find the #1 opponent every 10 matches or if we don't have one
        if (!targetOpponent || matchCount % 10 === 1) {
            log('正在搜寻全服最高分合格对手...');
            try {
                const opponents = await discoverTopEligibleOpponents(token, myTankId);
                if (opponents.length > 0) {
                    targetOpponent = opponents[0];
                    log(`[搜寻成功] 锁定对手 #1: ${targetOpponent.name}#${targetOpponent.id} (分数: ${targetOpponent.rankScore})`);
                } else {
                    log('[警告] 未搜寻到合格的对手，将在 5 秒后重试...');
                    await delay(cooldownMs);
                    continue;
                }
            } catch (e) {
                log(`[搜索对手异常]: ${e.message}，将在 5 秒后重试...`);
                await delay(cooldownMs);
                continue;
            }
        }

        log(`[第 ${matchCount} 场对战] 正在挑战第一名: ${targetOpponent.name}#${targetOpponent.id} (${targetOpponent.rankScore})`);

        try {
            const matchData = await fetchJson('https://agentank.ai/api/agent/tank/challenge', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    opponentTankId: targetOpponent.id,
                    mapId: 'random'
                })
            });

            let resultType = 'draw';
            if (matchData.winnerTankId === myTankId) {
                resultType = 'win';
            } else if (matchData.winnerTankId || matchData.winnerTankName || matchData.winner) {
                resultType = 'loss';
            }

            const urlId = matchData.urlId || matchData.matchUrlId;
            const reason = matchData.resultReason || matchData.reason;
            let rankDelta = getRankDelta(matchData, myTankId);
            let currentScore = previousScore;
            let currentRankPoints = previousRankPoints;

            try {
                const updatedContext = await getTankContext(token);
                currentScore = getScore(updatedContext);
                currentRankPoints = getRankPoints(updatedContext);
                if (rankDelta === null) rankDelta = currentScore - previousScore;
            } catch (e) {
                // Ignore API warning
            }

            log(
                `[第 ${matchCount} 场] 结果: ${resultType.toUpperCase()} | ` +
                `得分: ${currentScore} (${formatDelta(rankDelta)}) | ` +
                `点数: ${currentRankPoints} | ` +
                `原因: ${reason} | ` +
                `链接: https://agentank.ai/history/${urlId}`
            );

            previousScore = currentScore;
            previousRankPoints = currentRankPoints;

        } catch (e) {
            log(`[第 ${matchCount} 场] 运行异常: ${e.message}`);
        }

        log(`等待 ${cooldownMs / 1000} 秒后发起下一次挑战...\n`);
        await delay(cooldownMs);
    }
}

main();
