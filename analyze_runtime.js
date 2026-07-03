/**
 * 专门分析某场比赛的帧执行时间分布，找出热点耗时函数帧
 * 用法：node analyze_runtime.js <matchId>
 */
const fs = require('fs');
const path = require('path');
const { getToken } = require('./config');

const matchId = process.argv[2] || 'mat_4jYUSVfcHkA8gmJno';
const token = getToken();

const COOLDOWNS = {
    shield: 25, freeze: 29, stun: 20, overload: 32,
    cloak: 35, poison: 20, teleport: 40, boost: 26
};

function getNewDirection(currentDir, turn) {
    const dirs = ["up", "right", "down", "left"];
    const idx = dirs.indexOf(currentDir);
    if (idx === -1) return currentDir;
    if (turn === "left") return dirs[(idx - 1 + 4) % 4];
    if (turn === "right") return dirs[(idx + 1) % 4];
    return currentDir;
}

async function fetchMatchData(matchId) {
    const scratchDir = path.join(__dirname, 'scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
    const rawPath = path.join(scratchDir, `${matchId}_raw.json`);
    const summaryPath = path.join(scratchDir, `${matchId}_summary.json`);

    if (!fs.existsSync(rawPath) || !fs.existsSync(summaryPath)) {
        console.log(`[Analyzer] Downloading match data for ${matchId}...`);
        const summaryRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!summaryRes.ok) { console.error(`Error: HTTP ${summaryRes.status}`); process.exit(1); }
        fs.writeFileSync(summaryPath, JSON.stringify(await summaryRes.json(), null, 2));

        const rawRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=raw`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!rawRes.ok) { console.error(`Error: HTTP ${rawRes.status}`); process.exit(1); }
        fs.writeFileSync(rawPath, JSON.stringify(await rawRes.json(), null, 2));
        console.log(`[Analyzer] Downloaded and saved.`);
    }

    return {
        summary: JSON.parse(fs.readFileSync(summaryPath, 'utf8')),
        raw: JSON.parse(fs.readFileSync(rawPath, 'utf8'))
    };
}

async function main() {
    const { summary, raw } = await fetchMatchData(matchId);
    const records = raw.replayData.replay.records || [];
    const map = raw.replayData.map.map;
    const participants = summary.participants;

    let meId, enemyId, enemySkillType;
    const p0meta = raw.replayData.replay.meta.players[0];
    const p1meta = raw.replayData.replay.meta.players[1];
    // XDB's tankId is 230
    const meIsP0 = (participants.challenger && participants.challenger.tankName === "XDB") ?
        p0meta.tank.id === (participants.challenger.tankId ? undefined : p0meta.tank.id) : false;
    // Simpler: match by scanning participants
    if (participants.challenger && participants.challenger.tankName === "XDB") {
        // XDB is challenger = player[0] in most cases, but verify by checking first frame speak event
        // The speak "V12" will identify XDB's objectId
        let xdbId = null;
        for (const ev of (raw.replayData.replay.records[1] || [])) {
            if (ev.action === 'say' && ev.text && ev.text.startsWith('V')) {
                xdbId = ev.objectId;
                break;
            }
        }
        if (xdbId) {
            meId = xdbId;
            enemyId = p0meta.tank.id === xdbId ? p1meta.tank.id : p0meta.tank.id;
        } else {
            meId = p0meta.tank.id;
            enemyId = p1meta.tank.id;
        }
    } else if (participants.defender && participants.defender.tankName === "XDB") {
        let xdbId = null;
        for (const ev of (raw.replayData.replay.records[1] || [])) {
            if (ev.action === 'say' && ev.text && ev.text.startsWith('V')) {
                xdbId = ev.objectId;
                break;
            }
        }
        if (xdbId) {
            meId = xdbId;
            enemyId = p0meta.tank.id === xdbId ? p1meta.tank.id : p0meta.tank.id;
        } else {
            meId = p1meta.tank.id;
            enemyId = p0meta.tank.id;
        }
    } else {
        meId = p0meta.tank.id;
        enemyId = p1meta.tank.id;
    }
    const meIndex = p0meta.tank.id === meId ? 0 : 1;
    const enemyIndex = 1 - meIndex;

    for (const frameEvents of records) {
        for (const ev of frameEvents) {
            if (ev.sourceObjectId === enemyId && ev.action === "cast" && ev.skillType) {
                enemySkillType = ev.skillType;
                break;
            }
        }
        if (enemySkillType) break;
    }
    enemySkillType = enemySkillType || 'unknown';

    const p0 = raw.replayData.replay.meta.players[0];
    const p1 = raw.replayData.replay.meta.players[1];
    let mePos = (p0.tank.id === meId ? p0.tank.position : p1.tank.position).slice();
    let meDir = p0.tank.id === meId ? p0.tank.direction : p1.tank.direction;
    let enemyPos = (p0.tank.id === meId ? p1.tank.position : p0.tank.position).slice();
    let enemyDir = p0.tank.id === meId ? p1.tank.direction : p0.tank.direction;
    console.log(`[Analyzer] XDB id=${meId} (Player ${meIndex}), Enemy id=${enemyId}, Enemy skill=${enemySkillType || 'TBD'}`);
    let starPos = null;
    let bulletsMap = new Map();
    let meSkillCD = 0, enemySkillCD = 0, meFireLockTimer = 0, enemyFireLockTimer = 0;
    let meStars = 0, enemyStars = 0;
    let meStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
    let enemyStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };

    // Load tank code
    const newTankCode = fs.readFileSync(path.join(__dirname, 'new_tank.js'), 'utf8');
    const sandbox = { G_Blueprint: null, G_History: null, CONFIG: null, print: ()=>{} };
    const runCode = new Function('sandbox', `with (sandbox) { ${newTankCode}; sandbox.onIdle=onIdle; sandbox.G_Blueprint=G_Blueprint; sandbox.G_History=G_History; sandbox.CONFIG=CONFIG; sandbox.buildExecutionContext=buildExecutionContext; sandbox.strategicInit=strategicInit; sandbox.tacticalAnalysis=tacticalAnalysis; }`);
    runCode(sandbox);
    sandbox.G_Blueprint.initialized = false;
    sandbox.G_Blueprint.enemySeen = false;

    const frameTimes = [];
    let totalMs = 0;

    for (let f = 1; f < records.length; f++) {
        const frameEvents = records[f] || [];
        if (meSkillCD > 0) meSkillCD--;
        if (enemySkillCD > 0) enemySkillCD--;
        if (meFireLockTimer > 0) { meFireLockTimer--; if (meFireLockTimer === 0) meStatus.fireLocked = false; }
        if (enemyFireLockTimer > 0) { enemyFireLockTimer--; if (enemyFireLockTimer === 0) enemyStatus.fireLocked = false; }

        for (const ev of frameEvents) {
            const isMe = (ev.objectId === meId || ev.sourceObjectId === meId || ev.targetObjectId === meId);
            const isEnemy = (ev.objectId === enemyId || ev.sourceObjectId === enemyId || ev.targetObjectId === enemyId);

            if (isMe) {
                if (ev.action === "go" || ev.event === "move") mePos = (ev.position || ev.to).slice();
                else if (ev.action === "turn" || ev.event === "turn") meDir = getNewDirection(meDir, ev.direction);
                else if (ev.action === "applied" && ev.skillType === "teleport") { mePos = (ev.to).slice(); meStatus.fireLocked = true; meFireLockTimer = 2; }
                else if (ev.action === "applied" && ev.skillType === "boost") meStatus.boosted = true;
                else if (ev.event === "boost_ended") meStatus.boosted = false;
                else if (ev.action === "applied" && ev.skillType === "overload") meStatus.overloaded = true;
                else if (ev.event === "overload_ended") meStatus.overloaded = false;
            } else if (isEnemy) {
                if (ev.action === "go" || ev.event === "move") enemyPos = (ev.position || ev.to).slice();
                else if (ev.action === "turn" || ev.event === "turn") enemyDir = getNewDirection(enemyDir, ev.direction);
                else if (ev.action === "applied" && ev.skillType === "teleport") { enemyPos = (ev.to).slice(); enemyStatus.fireLocked = true; enemyFireLockTimer = 2; }
                else if (ev.action === "applied" && ev.skillType === "boost") enemyStatus.boosted = true;
                else if (ev.event === "boost_ended") enemyStatus.boosted = false;
                else if (ev.action === "applied" && ev.skillType === "overload") enemyStatus.overloaded = true;
                else if (ev.event === "overload_ended") enemyStatus.overloaded = false;
            }

            if (ev.type === "bullet") {
                if (ev.action === "created" && ev.position) bulletsMap.set(ev.objectId, { position: ev.position.slice(), direction: ev.direction || "up", shooterId: ev.tank ? ev.tank.id : null });
                else if (ev.action === "go" && ev.position) { let b = bulletsMap.get(ev.objectId); if (b) { b.position = ev.position.slice(); if (ev.direction) b.direction = ev.direction; } }
                else if (ev.action === "crashed") bulletsMap.delete(ev.objectId);
            }
            if (ev.type === "star" || ev.event === "star_spawned" || (ev.action === "created" && ev.type === "star")) {
                const sp = ev.position || ev.at;
                if (sp) starPos = sp.slice();
            }
            if (ev.event === "star_collected" || ev.action === "collected") {
                starPos = null;
                // ev.by is player index, or ev.objectId matches meId
                const collectorIsMe = (ev.by === meIndex) || (ev.objectId === meId);
                if (collectorIsMe) meStars++;
                else enemyStars++;
            }
            if (ev.action === "cast" && ev.type === "skill") {
                const cd = COOLDOWNS[ev.skillType] || 32;
                if (isMe) meSkillCD = cd;
                else if (isEnemy) enemySkillCD = cd;
            }
        }

        let meB = null, enemyB = null;
        for (const [bid, b] of bulletsMap.entries()) {
            if (b.shooterId === meId) meB = { position: b.position.slice(), direction: b.direction };
            else if (b.shooterId === enemyId) enemyB = { position: b.position.slice(), direction: b.direction };
        }

        const enemyInGrass = !!(sandbox.G_Blueprint.mapVision && sandbox.G_Blueprint.mapVision.grass[enemyPos[0] + "," + enemyPos[1]]);
        const enemyVisible = !enemyStatus.cloaked && !enemyInGrass;

        const me = {
            tank: { id: 230, position: mePos.slice(), direction: meDir, crashed: false },
            stars: meStars, bullet: meB,
            skill: { type: "teleport", cooldownFrames: 40, remainingCooldownFrames: meSkillCD, activeRemainingFrames: 0, activeType: null },
            status: Object.assign({}, meStatus),
            go: ()=>{}, turn: ()=>{}, fire: ()=>{}, speak: ()=>{}, teleport: ()=>{}
        };
        const enemy = {
            tank: enemyVisible ? { id: 999, position: enemyPos.slice(), direction: enemyDir, crashed: false } : null,
            bullet: enemyB, stars: enemyStars,
            skill: { type: enemySkillType, cooldownFrames: COOLDOWNS[enemySkillType] || 35, remainingCooldownFrames: enemySkillCD, activeRemainingFrames: 0, activeType: null },
            status: Object.assign({}, enemyStatus)
        };
        const game = { map, star: starPos ? starPos.slice() : null, frames: f };

        try {
            sandbox.G_History.frame = f;
            if (!sandbox.G_Blueprint.initialized || (enemy.tank && !sandbox.G_Blueprint.enemySeen)) {
                sandbox.strategicInit(enemy, game.map);
            }

            const t0 = performance.now();
            sandbox.onIdle(me, enemy, game);
            const t1 = performance.now();
            const elapsed = t1 - t0;
            frameTimes.push({ frame: f, ms: elapsed, enemyVisible, starPos: starPos ? starPos.slice() : null, mePos: mePos.slice(), meSkillCD });
            totalMs += elapsed;
        } catch (e) {
            console.error(`Frame ${f} error:`, e.message);
        }
    }

    // Analysis output
    const maxMs = Math.max(...frameTimes.map(x => x.ms));
    const avgMs = totalMs / frameTimes.length;
    const slowFrames = frameTimes.filter(x => x.ms > 5).sort((a, b) => b.ms - a.ms);

    console.log(`\n=================== Runtime Analysis: ${matchId} ===================`);
    console.log(`  Enemy Skill: ${enemySkillType}`);
    console.log(`  Total Frames Simulated: ${frameTimes.length}`);
    console.log(`  Total CPU Time: ${totalMs.toFixed(2)}ms`);
    console.log(`  Average per Frame: ${avgMs.toFixed(3)}ms`);
    console.log(`  Max Frame Time: ${maxMs.toFixed(3)}ms`);
    console.log(`  Slow Frames (>5ms): ${slowFrames.length} / ${frameTimes.length}`);

    if (slowFrames.length > 0) {
        console.log(`\n=================== TOP SLOW FRAMES ===================`);
        slowFrames.slice(0, 20).forEach(x => {
            console.log(`  Frame ${String(x.frame).padStart(3)}: ${x.ms.toFixed(3)}ms | enemyVisible=${x.enemyVisible} | meCD=${x.meSkillCD} | starPos=${JSON.stringify(x.starPos)} | mePos=${JSON.stringify(x.mePos)}`);
        });
    }

    // Distribution histogram
    console.log(`\n=================== TIME DISTRIBUTION ===================`);
    const buckets = [0, 1, 2, 5, 10, 20, 50, 100];
    for (let i = 0; i < buckets.length - 1; i++) {
        const lo = buckets[i], hi = buckets[i+1];
        const count = frameTimes.filter(x => x.ms >= lo && x.ms < hi).length;
        const bar = '█'.repeat(Math.min(40, Math.round(count / frameTimes.length * 80)));
        console.log(`  [${String(lo).padStart(3)}-${String(hi).padEnd(3)}ms]: ${String(count).padStart(4)} frames ${bar}`);
    }
    const gt100 = frameTimes.filter(x => x.ms >= 100).length;
    if (gt100 > 0) console.log(`  [ >100ms]: ${String(gt100).padStart(4)} frames`);

    // A* callcount check: look at frames where canTeleport=true vs false
    const framesWithCD0 = frameTimes.filter(x => x.meSkillCD === 0);
    const avgMS_cd0 = framesWithCD0.length > 0 ? framesWithCD0.reduce((a, b) => a + b.ms, 0) / framesWithCD0.length : 0;
    const framesWithCDGT0 = frameTimes.filter(x => x.meSkillCD > 0);
    const avgMS_cdGT0 = framesWithCDGT0.length > 0 ? framesWithCDGT0.reduce((a, b) => a + b.ms, 0) / framesWithCDGT0.length : 0;
    console.log(`\n=================== TELEPORT CD CORRELATION ===================`);
    console.log(`  When teleport ready (CD=0):    ${framesWithCD0.length} frames, avg ${avgMS_cd0.toFixed(3)}ms`);
    console.log(`  When teleport not ready (CD>0): ${framesWithCDGT0.length} frames, avg ${avgMS_cdGT0.toFixed(3)}ms`);
}

main().catch(e => { console.error(e); process.exit(1); });
