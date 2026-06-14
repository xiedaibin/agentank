const fs = require('fs');
const { getToken } = require('./config');

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

function normalizeMapList(maps) {
    if (!maps) return [];

    if (Array.isArray(maps)) {
        return maps
            .map(map => {
                if (typeof map === 'string') return map;
                return map.id || map.mapId || map.slug || map.name;
            })
            .filter(Boolean);
    }

    if (typeof maps === 'object') {
        return Object.entries(maps)
            .map(([key, map]) => {
                if (typeof map === 'string') return map;
                if (map && typeof map === 'object') {
                    return map.id || map.mapId || map.slug || map.name || key;
                }
                return key;
            })
            .filter(Boolean);
    }

    return [];
}

function extractMapIds(context) {
    const candidates = [
        context && context.maps,
        context && context.availableMaps,
        context && context.mapList,
        context && context.availableMapList
    ];

    for (const candidate of candidates) {
        const ids = normalizeMapList(candidate);
        if (ids.length > 0) return ids;
    }

    return ['classic'];
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
    const extras = ['tank', 'debug', 'rank', 'bot', 'ai', 'king', '666', '王', '战', '坦克'];
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
            console.warn(`Opponent search failed for "${query}": ${e.message}`);
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
    const totalMatches = parseInt(process.argv[2], 10) || 10;
    const opponentMode = (process.argv[3] || 'random').toLowerCase();
    const mapMode = (process.argv[4] || 'random').toLowerCase();
    const cooldownMs = parseInt(process.argv[5], 10) || 5000;

    const report = {
        summary: { requested: totalMatches, total: 0, wins: 0, losses: 0, draws: 0 },
        mapRotation: [],
        opponentMode,
        mapMode,
        topEligibleOpponents: [],
        matches: []
    };

    let myTankId = 230;
    let previousScore = 0;
    let previousRankPoints = 0;
    let mapIds = ['classic'];
    let targetOpponents = [];

    console.log(`Starting batch of ${totalMatches} matches...`);

    try {
        const tankContext = await getTankContext(token);
        myTankId = tankContext.tank && tankContext.tank.id ? tankContext.tank.id : myTankId;
        previousScore = getScore(tankContext);
        previousRankPoints = getRankPoints(tankContext);
        mapIds = extractMapIds(tankContext);

        report.summary.initialRankScore = previousScore;
        report.summary.initialRankPoints = previousRankPoints;
        report.mapRotation = mapIds;

        console.log(`Tank ID: ${myTankId}`);
        console.log(`Initial rankScore: ${previousScore} | rankPoints: ${previousRankPoints}`);
        console.log(`Map mode: ${mapMode}`);
        console.log(`Available maps: ${mapIds.join(', ')}`);

        if (mapIds.length === 1) {
            console.log(`Only one map was returned by the API; every match will use ${mapIds[0]}.`);
        }
    } catch (e) {
        console.warn(`Failed to load tank context, using fallback settings: ${e.message}`);
        report.summary.initialRankScore = previousScore;
        report.summary.initialRankPoints = previousRankPoints;
        report.mapRotation = mapIds;
    }

    if (opponentMode === 'best') {
        console.log('Discovering high-score eligible opponents...');
        targetOpponents = await discoverTopEligibleOpponents(token, myTankId);
        report.topEligibleOpponents = targetOpponents.slice(0, 10).map(opponent => ({
            id: opponent.id,
            name: opponent.name,
            rankScore: opponent.rankScore,
            rankTier: opponent.rankTier,
            rankDivision: opponent.rankDivision,
            rankPoints: opponent.rankPoints,
            skillType: opponent.skillType
        }));

        if (targetOpponents.length > 0) {
            const topList = report.topEligibleOpponents
                .map(opponent => `${opponent.name}#${opponent.id}(${opponent.rankScore})`)
                .join(', ');
            console.log(`Top eligible opponents: ${topList}`);
        } else {
            console.log('No eligible target opponent was discovered; falling back to random opponents.');
        }
    } else {
        console.log('Opponent mode: random eligible opponent selected by server.');
    }

    for (let i = 1; i <= totalMatches; i++) {
        const mapId = mapMode === 'rotate' ? mapIds[(i - 1) % mapIds.length] : 'random';
        const targetOpponent = targetOpponents.length > 0
            ? targetOpponents[(i - 1) % Math.min(targetOpponents.length, 5)]
            : null;
        const challengeBody = targetOpponent
            ? { opponentTankId: targetOpponent.id, mapId }
            : { randomOpponent: true, mapId };

        const opponentLabel = targetOpponent
            ? `${targetOpponent.name}#${targetOpponent.id} (${targetOpponent.rankScore})`
            : 'server random';

        console.log(`\n[Match ${i}/${totalMatches}] Initiating challenge | Opponent: ${opponentLabel} | Map: ${mapId}`);

        try {
            const matchData = await fetchJson('https://agentank.ai/api/agent/tank/challenge', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(challengeBody)
            });

            let resultType = 'draw';
            report.summary.total++;

            if (matchData.winnerTankId === myTankId) {
                resultType = 'win';
                report.summary.wins++;
            } else if (matchData.winnerTankId || matchData.winnerTankName || matchData.winner) {
                resultType = 'loss';
                report.summary.losses++;
            } else {
                report.summary.draws++;
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
                console.warn(`[Match ${i}] Failed to refresh rankScore: ${e.message}`);
            }

            console.log(
                `[Match ${i}] Result: ${resultType.toUpperCase()} | ` +
                `Map: ${mapId} | ` +
                `Opponent: ${matchData.defenderTankName || 'Unknown'} | ` +
                `Score: ${currentScore} (${formatDelta(rankDelta)}) | ` +
                `Points: ${currentRankPoints} | ` +
                `Reason: ${reason} | ` +
                `URL: https://agentank.ai/history/${urlId}`
            );

            report.matches.push({
                matchNum: i,
                status: 'success',
                result: resultType,
                mapId,
                challengeBody,
                reason,
                matchUrlId: urlId,
                opponent: matchData.defenderTankName || 'Unknown',
                opponentTankId: matchData.defenderTankId,
                winnerTankId: matchData.winnerTankId,
                winnerTankName: matchData.winnerTankName,
                rankDelta,
                rankScoreAfter: currentScore,
                rankPointsAfter: currentRankPoints,
                agentReplayUrl: `https://agentank.ai/api/matches/${urlId}/agent.json`
            });

            previousScore = currentScore;
            previousRankPoints = currentRankPoints;
        } catch (e) {
            console.error(`[Match ${i}] Exception:`, e.message);
            report.matches.push({ matchNum: i, status: 'error', mapId, error: e.message });
        }

        if (i < totalMatches) {
            console.log(`Waiting ${Math.round(cooldownMs / 1000)} seconds for cooldown...`);
            await delay(cooldownMs);
        }
    }

    report.summary.finalRankScore = previousScore;
    report.summary.finalRankPoints = previousRankPoints;
    report.summary.rankScoreDelta = previousScore - report.summary.initialRankScore;

    console.log('\n=== Batch Complete ===');
    console.log(`Wins: ${report.summary.wins} | Losses: ${report.summary.losses} | Draws: ${report.summary.draws}`);
    console.log(`RankScore: ${report.summary.initialRankScore} -> ${previousScore} (${formatDelta(report.summary.rankScoreDelta)})`);

    const reportDir = 'logs';
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(`${reportDir}/battle_report.json`, JSON.stringify(report, null, 2));
    console.log(`Detailed report saved to ${reportDir}/battle_report.json`);
}

main();
