const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

const token = getToken();
const replayDir = path.join(__dirname, '../batch_evolution_replays');
const outputJson = path.join(__dirname, 'losses_summary.json');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const skillCache = {};

async function getOpponentSkill(tankId, tankName) {
    if (skillCache[tankId]) return skillCache[tankId];
    try {
        const res = await fetch(`https://agentank.ai/api/agent/opponents?q=${tankId}&limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const opp = data.opponents?.[0];
            if (opp && opp.skillType) {
                skillCache[tankId] = opp.skillType;
                return opp.skillType;
            }
        }
    } catch (e) {
        console.error(`Error querying skill for ${tankName} (${tankId}):`, e.message);
    }
    return 'unknown';
}

async function getMatchSpeaks(matchId) {
    try {
        const res = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=events`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            const events = data.events || data.records || [];
            const speaks = [];
            events.forEach(ev => {
                if (ev.event === "speak" && ev.tankId === 230) {
                    speaks.push({
                        frame: ev.frame,
                        text: ev.text
                    });
                }
            });
            return speaks;
        }
    } catch (e) {
        console.error(`Error fetching events for match ${matchId}:`, e.message);
    }
    return [];
}

async function run() {
    if (!fs.existsSync(replayDir)) {
        console.error(`Directory ${replayDir} not found.`);
        return;
    }

    const files = fs.readdirSync(replayDir).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} replay files to analyze.`);

    const cases = [];

    for (const file of files) {
        const filePath = path.join(replayDir, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const match = data.match || {};
            const summary = data.summary || {};
            const participants = data.participants || {};

            const challenger = participants.challenger || {};
            const defender = participants.defender || {};

            let opponent = {};
            if (challenger.tankId === 230) {
                opponent = defender;
            } else {
                opponent = challenger;
            }

            const opponentName = opponent.tankName || 'Unknown';
            const opponentId = opponent.tankId;

            console.log(`Analyzing file: ${file} (Opponent: ${opponentName}, ID: ${opponentId})`);

            // Get skill
            const skill = await getOpponentSkill(opponentId, opponentName);

            // Get speaks
            const speaks = await getMatchSpeaks(match.urlId);

            const myStats = summary.tanks?.XDB || {};
            const enemyStats = summary.tanks?.[opponentName] || {};

            cases.push({
                file,
                matchId: match.urlId,
                opponentName,
                opponentId,
                opponentSkill: skill,
                winner: match.winnerTankName,
                reason: match.resultReason,
                duration: summary.framesTotal,
                myStars: myStats.stars || 0,
                enemyStars: enemyStats.stars || 0,
                myDiagnosis: myStats.diagnosis || 'no diagnosis',
                enemyDiagnosis: enemyStats.diagnosis || 'no diagnosis',
                speaks
            });

            await delay(1000); // rate limiting
        } catch (e) {
            console.error(`Error processing ${file}:`, e.stack);
        }
    }

    fs.writeFileSync(outputJson, JSON.stringify(cases, null, 2));
    console.log(`Successfully wrote ${cases.length} cases to ${outputJson}`);
}

run().catch(console.error);
