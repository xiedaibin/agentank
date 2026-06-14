const fs = require('fs');
const path = require('path');
const { getToken } = require('./config');

const logFile = 'logs/battle_first.log';
const replayDir = 'battle_first';
const roundSize = 10;
const finiteSearchRetryLimit = 5;

// Ensure logs directory exists
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function log(msg) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const line = `[${timestamp}] ${msg}`;
    console.log(msg);
    fs.appendFileSync(logFile, line + '\n');
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs() {
    const arg = process.argv[2];

    if (!arg || arg === 'infinite') {
        return { isInfinite: true, maxMatches: Infinity };
    }

    const maxMatches = parseInt(arg, 10);
    if (!Number.isFinite(maxMatches) || maxMatches <= 0) {
        return { error: '用法: node battle_first.js [次数|infinite]' };
    }

    return { isInfinite: false, maxMatches };
}

function ensureReplayDir() {
    if (!fs.existsSync(replayDir)) {
        fs.mkdirSync(replayDir, { recursive: true });
    }
}

function sanitizeFilenamePart(value) {
    return String(value || 'Unknown')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 60) || 'Unknown';
}

function formatRate(wins, total) {
    if (!total) return '0.00%';
    return `${(wins / total * 100).toFixed(2)}%`;
}

function createStats() {
    return {
        total: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        errors: 0,
        failedReplayDownloads: 0,
        opponents: new Map()
    };
}

function getOpponentKey(matchData, fallbackOpponent) {
    const id = matchData.defenderTankId || (fallbackOpponent && fallbackOpponent.id) || 'unknown';
    const name = matchData.defenderTankName || (fallbackOpponent && fallbackOpponent.name) || 'Unknown';
    return `${name}#${id}`;
}

function getOpponentStats(stats, matchData, fallbackOpponent) {
    const key = getOpponentKey(matchData, fallbackOpponent);
    if (!stats.opponents.has(key)) {
        stats.opponents.set(key, {
            name: matchData.defenderTankName || (fallbackOpponent && fallbackOpponent.name) || 'Unknown',
            id: matchData.defenderTankId || (fallbackOpponent && fallbackOpponent.id) || 'unknown',
            rankScore: (fallbackOpponent && fallbackOpponent.rankScore) || matchData.defenderRankScore || null,
            total: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            errors: 0,
            replayFiles: []
        });
    }

    return stats.opponents.get(key);
}

function recordResult(stats, resultType, matchData, fallbackOpponent) {
    stats.total++;
    if (resultType === 'win') stats.wins++;
    else if (resultType === 'loss') stats.losses++;
    else stats.draws++;

    const opponentStats = getOpponentStats(stats, matchData, fallbackOpponent);
    opponentStats.total++;
    if (resultType === 'win') opponentStats.wins++;
    else if (resultType === 'loss') opponentStats.losses++;
    else opponentStats.draws++;
    return opponentStats;
}

function recordError(stats, fallbackOpponent) {
    stats.errors++;
    if (!fallbackOpponent) return null;

    const opponentStats = getOpponentStats(stats, {}, fallbackOpponent);
    opponentStats.errors++;
    return opponentStats;
}

async function downloadLossReplay(token, matchData, matchCount, opponentStats) {
    const urlId = matchData.urlId || matchData.matchUrlId;
    if (!urlId) return null;

    ensureReplayDir();
    const safeOpponent = sanitizeFilenamePart(opponentStats.name);
    const safeUrlId = sanitizeFilenamePart(urlId);
    const sequence = String(matchCount).padStart(3, '0');
    const filename = `${safeOpponent}_${sequence}_${safeUrlId}.json`;
    const filePath = path.join(replayDir, filename);

    const replay = await fetchJson(`https://agentank.ai/api/matches/${urlId}/agent.json`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    fs.writeFileSync(filePath, JSON.stringify(replay, null, 2));
    opponentStats.replayFiles.push(filePath);
    return filePath;
}

function logSummary(stats, attempts, initialScore, finalScore, initialRankPoints, finalRankPoints) {
    log('\n=== 挂机第一模式统计 ===');
    log(
        `发起挑战: ${attempts} | 有效对战: ${stats.total} | 胜: ${stats.wins} | 负: ${stats.losses} | 平: ${stats.draws} | ` +
        `异常: ${stats.errors} | 总胜率: ${formatRate(stats.wins, stats.total)}`
    );
    log(
        `RankScore: ${initialScore} -> ${finalScore} (${formatDelta(finalScore - initialScore)}) | ` +
        `RankPoints: ${initialRankPoints} -> ${finalRankPoints} (${formatDelta(finalRankPoints - initialRankPoints)})`
    );

    if (stats.failedReplayDownloads > 0) {
        log(`失败录像下载失败: ${stats.failedReplayDownloads} 个`);
    }

    log('--- 按对手统计 ---');
    const rows = [...stats.opponents.values()].sort((a, b) => {
        const aAttempts = a.total + a.errors;
        const bAttempts = b.total + b.errors;
        if (bAttempts !== aAttempts) return bAttempts - aAttempts;
        return b.wins - a.wins;
    });

    for (const opponent of rows) {
        log(
            `${opponent.name}#${opponent.id} | 分数: ${opponent.rankScore || 'n/a'} | ` +
            `有效对战: ${opponent.total} | 胜: ${opponent.wins} | 负: ${opponent.losses} | 平: ${opponent.draws} | ` +
            `异常: ${opponent.errors} | 胜率: ${formatRate(opponent.wins, opponent.total)} | ` +
            `失败录像: ${opponent.replayFiles.length}`
        );
    }
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
    const args = parseArgs();
    if (args.error) {
        console.log(args.error);
        return;
    }

    fs.writeFileSync(logFile, '');

    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }
    const cooldownMs = 5000;
    let myTankId = 230;
    let previousScore = 0;
    let previousRankPoints = 0;
    let initialScore = 0;
    let initialRankPoints = 0;
    let targetOpponent = null;
    let matchCount = 0;
    let searchMisses = 0;
    const stats = createStats();

    log('=== 挂机第一模式启动 ===');
    log(`模式: ${args.isInfinite ? '无限循环' : `对战 ${args.maxMatches} 场，约 ${Math.ceil(args.maxMatches / roundSize)} 轮`}`);
    log('正在初始化坦克数据...');

    try {
        const tankContext = await getTankContext(token);
        myTankId = tankContext.tank && tankContext.tank.id ? tankContext.tank.id : myTankId;
        previousScore = getScore(tankContext);
        previousRankPoints = getRankPoints(tankContext);
        initialScore = previousScore;
        initialRankPoints = previousRankPoints;
        log(`我的坦克 ID: ${myTankId} | 当前分数: ${previousScore} | 当前点数: ${previousRankPoints}`);
    } catch (e) {
        log(`[警告] 初始化获取坦克数据失败，将使用默认配置: ${e.message}`);
    }

    while (matchCount < args.maxMatches) {
        const nextMatchCount = matchCount + 1;

        // Refresh/Find the #1 opponent every 10 matches or if we don't have one
        if (!targetOpponent || nextMatchCount % roundSize === 1) {
            const roundNo = Math.ceil(nextMatchCount / roundSize);
            log(`[第 ${roundNo} 轮] 正在搜寻全服最高分合格对手...`);
            try {
                const opponents = await discoverTopEligibleOpponents(token, myTankId);
                if (opponents.length > 0) {
                    targetOpponent = opponents[0];
                    searchMisses = 0;
                    log(`[搜寻成功] 锁定对手 #1: ${targetOpponent.name}#${targetOpponent.id} (分数: ${targetOpponent.rankScore})`);
                } else {
                    log('[警告] 未搜寻到合格的对手，将在 5 秒后重试...');
                    searchMisses++;
                    if (!args.isInfinite && searchMisses >= finiteSearchRetryLimit) {
                        log(`[终止] 连续 ${searchMisses} 次未搜到合格对手，有限模式提前结束。`);
                        break;
                    }
                    await delay(cooldownMs);
                    continue;
                }
            } catch (e) {
                log(`[搜索对手异常]: ${e.message}，将在 5 秒后重试...`);
                searchMisses++;
                if (!args.isInfinite && searchMisses >= finiteSearchRetryLimit) {
                    log(`[终止] 连续 ${searchMisses} 次搜索异常，有限模式提前结束。`);
                    break;
                }
                await delay(cooldownMs);
                continue;
            }
        }

        matchCount = nextMatchCount;
        log(
            `[第 ${matchCount}${args.isInfinite ? '' : `/${args.maxMatches}`} 场对战] ` +
            `正在挑战第一名: ${targetOpponent.name}#${targetOpponent.id} (${targetOpponent.rankScore})`
        );

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
            const opponentStats = recordResult(stats, resultType, matchData, targetOpponent);

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

            if (resultType === 'loss') {
                try {
                    const replayPath = await downloadLossReplay(token, matchData, matchCount, opponentStats);
                    if (replayPath) {
                        log(`[第 ${matchCount} 场] 失败录像已保存: ${replayPath}`);
                    } else {
                        stats.failedReplayDownloads++;
                        log(`[第 ${matchCount} 场] 未找到 matchUrlId，无法下载失败录像`);
                    }
                } catch (e) {
                    stats.failedReplayDownloads++;
                    log(`[第 ${matchCount} 场] 失败录像下载失败: ${e.message}`);
                }
            }

            previousScore = currentScore;
            previousRankPoints = currentRankPoints;

        } catch (e) {
            recordError(stats, targetOpponent);
            log(`[第 ${matchCount} 场] 运行异常: ${e.message}`);
        }

        if (matchCount < args.maxMatches) {
            log(`等待 ${cooldownMs / 1000} 秒后发起下一次挑战...\n`);
            await delay(cooldownMs);
        }
    }

    logSummary(stats, matchCount, initialScore, previousScore, initialRankPoints, previousRankPoints);
}

main();
