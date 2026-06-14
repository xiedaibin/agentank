const fs = require('fs');
const { getToken } = require('./config');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeout = 12000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function challengeWithRetry(token, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetchWithTimeout('https://agentank.ai/api/agent/tank/challenge', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    randomOpponent: true,
                    mapId: 'classic'
                })
            }, 12000); // 12 second timeout per attempt

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Status ${res.status}: ${text}`);
            }

            return await res.json();
        } catch (e) {
            console.warn(`Challenge attempt ${attempt} failed: ${e.message}`);
            if (attempt === maxRetries) {
                throw e;
            }
            console.log(`Waiting 4 seconds before retrying...`);
            await delay(4000);
        }
    }
}

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
        process.exit(1);
    }
    const totalMatches = parseInt(process.argv[2]) || 10;

    const report = {
        summary: { total: totalMatches, wins: 0, losses: 0, draws: 0 },
        matches: []
    };

    console.log(`Starting batch of ${totalMatches} matches with automatic timeout and retry logic...`);

    for (let i = 1; i <= totalMatches; i++) {
        console.log(`\n[Match ${i}/${totalMatches}] Initiating challenge...`);
        try {
            const matchData = await challengeWithRetry(token, 3);
            let resultType = "draw";
            if (matchData.winnerTankId === 230 || matchData.winnerTankName === "XDB" || matchData.winner === "XDB") {
                resultType = "win";
                report.summary.wins++;
            } else if (matchData.winnerTankId || matchData.winnerTankName || matchData.winner) {
                resultType = "loss";
                report.summary.losses++;
            } else {
                report.summary.draws++;
            }

            const urlId = matchData.urlId || matchData.matchUrlId;
            const reason = matchData.resultReason || matchData.reason;
            console.log(`[Match ${i}] Result: ${resultType.toUpperCase()} | Reason: ${reason} | URL: https://agentank.ai/history/${urlId}`);
            
            report.matches.push({
                matchNum: i,
                status: 'success',
                result: resultType,
                reason: reason,
                matchUrlId: urlId,
                opponent: matchData.defenderTankName || "Unknown",
                opponentTankId: matchData.defenderTankId,
                winnerTankId: matchData.winnerTankId,
                winnerTankName: matchData.winnerTankName,
                agentReplayUrl: `https://agentank.ai/api/matches/${urlId}/agent.json`
            });
        } catch (e) {
            console.error(`[Match ${i}] Failed completely after retries:`, e.message);
            report.matches.push({ matchNum: i, status: 'error', error: e.message });
        }

        // Wait 3 seconds to strictly respect the rate limit
        if (i < totalMatches) {
            console.log(`Waiting 3 seconds for cooldown...`);
            await delay(3000);
        }
    }

    console.log("\n=== Batch Complete ===");
    console.log(`Wins: ${report.summary.wins} | Losses: ${report.summary.losses} | Draws: ${report.summary.draws}`);
    
    const reportDir = 'logs';
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(`${reportDir}/battle_report.json`, JSON.stringify(report, null, 2));
    console.log(`Detailed report saved to ${reportDir}/battle_report.json`);
}

main();
