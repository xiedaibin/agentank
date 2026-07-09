/**
 * 函数级热点分析：找出 new_tank.js 中最耗时的函数调用
 * node profile_runtime.js mat_4jYUSVfcHkA8gmJno
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
        console.log(`[Profiler] Downloading match data for ${matchId}...`);
        const summaryRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fs.writeFileSync(summaryPath, JSON.stringify(await summaryRes.json(), null, 2));
        const rawRes = await fetch(`https://agentank.ai/api/matches/${matchId}/agent.json?view=raw`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        fs.writeFileSync(rawPath, JSON.stringify(await rawRes.json(), null, 2));
        console.log(`[Profiler] Downloaded and saved.`);
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

    // Identify XDB and enemy by speak in frame 1
    const p0meta = raw.replayData.replay.meta.players[0];
    const p1meta = raw.replayData.replay.meta.players[1];
    let meId = null, enemyId = null;
    for (const ev of (records[1] || [])) {
        if (ev.action === 'say' && ev.text && ev.text.startsWith('V')) {
            meId = ev.objectId;
            break;
        }
    }
    if (!meId) meId = p0meta.tank.id;
    enemyId = p0meta.tank.id === meId ? p1meta.tank.id : p0meta.tank.id;

    let enemySkillType = 'unknown';
    for (const frameEvents of records) {
        for (const ev of frameEvents) {
            if (ev.sourceObjectId === enemyId && ev.action === "cast" && ev.skillType) {
                enemySkillType = ev.skillType;
                break;
            }
        }
        if (enemySkillType !== 'unknown') break;
    }

    const meIndex = p0meta.tank.id === meId ? 0 : 1;
    const enemyIndex = 1 - meIndex;

    const p0 = raw.replayData.replay.meta.players[0];
    const p1 = raw.replayData.replay.meta.players[1];
    let mePos = (p0.tank.id === meId ? p0.tank.position : p1.tank.position).slice();
    let meDir = p0.tank.id === meId ? p0.tank.direction : p1.tank.direction;
    let enemyPos = (p0.tank.id === meId ? p1.tank.position : p0.tank.position).slice();
    let enemyDir = p0.tank.id === meId ? p1.tank.direction : p0.tank.direction;
    let starPos = null;
    let bulletsMap = new Map();
    let meSkillCD = 0, enemySkillCD = 0, meFireLockTimer = 0, enemyFireLockTimer = 0;
    let meStars = 0, enemyStars = 0;
    let meStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };
    let enemyStatus = { shielded: false, cloaked: false, boosted: false, overloaded: false, frozen: false, stunned: false, poisoned: false, fireLocked: false };

    // Load tank code and instrument it
    const newTankCode = fs.readFileSync(path.join(__dirname, 'new_tank.js'), 'utf8');

    // Instrument key functions with timing
    const PROFILE_COUNTERS = {};
    const PROFILE_MS = {};

    const instrumentedCode = newTankCode
        .replace(/^function (aStarSearch|findTeleportCandidates|findBestStarTeleportTarget|findPathAmbushSpot|getEnemyPredictedPath|findGrassAmbushTarget|calculateDangerTiles|isSafe|isSafeForStarWalking|getEnemyBulletArrivalTime|canShoot|isLoS|evalAssassination|evalStarCollection|evalStarGuard|evalPathAmbush|evalPathAmbushFire|evalGrassAmbushAndSurvival|evalShooting|tacticalAnalysis|buildExecutionContext|strategicInit)\b/mg, function(match, fnName) {
            return `function ${fnName}_ORIG`;
        });

    const sandbox = {
        G_Blueprint: null,
        G_History: null,
        CONFIG: null,
        print: () => {},
        __profileCounters: PROFILE_COUNTERS,
        __profileMs: PROFILE_MS
    };

    // Build the actual code with profiling wrappers
    const runCode = new Function('sandbox', `
        with (sandbox) {
            ${newTankCode}

            // Wrap key functions for profiling
            function _wrap(name, fn) {
                return function() {
                    var t0 = performance.now();
                    var result = fn.apply(this, arguments);
                    var t1 = performance.now();
                    sandbox.__profileCounters[name] = (sandbox.__profileCounters[name] || 0) + 1;
                    sandbox.__profileMs[name] = (sandbox.__profileMs[name] || 0) + (t1 - t0);
                    return result;
                };
            }

            var _aStar = aStar;
            aStar = _wrap('aStar', _aStar);

            var _findBestStarTeleportTarget = findBestStarTeleportTarget;
            findBestStarTeleportTarget = _wrap('findBestStarTeleportTarget', _findBestStarTeleportTarget);

            var _findPathAmbushSpot = findPathAmbushSpot;
            findPathAmbushSpot = _wrap('findPathAmbushSpot', _findPathAmbushSpot);

            var _getEnemyPredictedPath = getEnemyPredictedPath;
            getEnemyPredictedPath = _wrap('getEnemyPredictedPath', _getEnemyPredictedPath);

            var _buildDangerTilesCache = buildDangerTilesCache;
            buildDangerTilesCache = _wrap('buildDangerTilesCache', _buildDangerTilesCache);

            var _isSafe = isSafe;
            isSafe = _wrap('isSafe', _isSafe);

            var _isSafeForStarWalking = isSafeForStarWalking;
            isSafeForStarWalking = _wrap('isSafeForStarWalking', _isSafeForStarWalking);

            var _isSafeForStarTeleport = isSafeForStarTeleport;
            isSafeForStarTeleport = _wrap('isSafeForStarTeleport', _isSafeForStarTeleport);

            var _canShoot = canShoot;
            canShoot = _wrap('canShoot', _canShoot);

            var _isLoS = isLoS;
            isLoS = _wrap('isLoS', _isLoS);

            var _evalAssassination = evalAssassination;
            evalAssassination = _wrap('evalAssassination', _evalAssassination);

            var _evalStarCollection = evalStarCollection;
            evalStarCollection = _wrap('evalStarCollection', _evalStarCollection);

            var _evalStarGuard = evalStarGuard;
            evalStarGuard = _wrap('evalStarGuard', _evalStarGuard);

            var _evalPathAmbush = evalPathAmbush;
            evalPathAmbush = _wrap('evalPathAmbush', _evalPathAmbush);

            var _evalPathAmbushFire = evalPathAmbushFire;
            evalPathAmbushFire = _wrap('evalPathAmbushFire', _evalPathAmbushFire);

            var _evalGrassAmbushAndSurvival = evalGrassAmbushAndSurvival;
            evalGrassAmbushAndSurvival = _wrap('evalGrassAmbushAndSurvival', _evalGrassAmbushAndSurvival);

            var _evalShooting = evalShooting;
            evalShooting = _wrap('evalShooting', _evalShooting);

            if (typeof evalAssassinationPreAim !== 'undefined') {
                var _evalAssassinationPreAim = evalAssassinationPreAim;
                evalAssassinationPreAim = _wrap('evalAssassinationPreAim', _evalAssassinationPreAim);
            }

            var _findAssassinSpot = findAssassinSpot;
            findAssassinSpot = _wrap('findAssassinSpot', _findAssassinSpot);

            var _findSafeGrassSpot = findSafeGrassSpot;
            findSafeGrassSpot = _wrap('findSafeGrassSpot', _findSafeGrassSpot);

            var _findBestDodge = findBestDodge;
            findBestDodge = _wrap('findBestDodge', _findBestDodge);

            var _getNextStep = getNextStep;
            getNextStep = _wrap('getNextStep', _getNextStep);




            sandbox.onIdle = onIdle;
            sandbox.G_Blueprint = G_Blueprint;
            sandbox.G_History = G_History;
            sandbox.CONFIG = CONFIG;
            sandbox.buildExecutionContext = buildExecutionContext;
            sandbox.strategicInit = strategicInit;
        }
    `);

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
            } else if (isEnemy) {
                if (ev.action === "go" || ev.event === "move") enemyPos = (ev.position || ev.to).slice();
                else if (ev.action === "turn" || ev.event === "turn") enemyDir = getNewDirection(enemyDir, ev.direction);
                else if (ev.action === "applied" && ev.skillType === "teleport") enemyPos = (ev.to).slice();
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
            go: () => {}, turn: () => {}, fire: () => {}, speak: () => {}, teleport: () => {}
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
            frameTimes.push({ frame: f, ms: elapsed });
            totalMs += elapsed;
        } catch (e) {
            console.error(`Frame ${f} error:`, e.message);
        }
    }

    // Print profiling summary
    console.log(`\n=================== Function Call Profile: ${matchId} ===================`);
    console.log(`  Total simulated frames: ${frameTimes.length}`);
    console.log(`  Total simulated time: ${totalMs.toFixed(2)}ms`);
    console.log(`\n  Function                       | Calls    | Total(ms) | Avg(ms)  | %Total`);
    console.log(`  -------------------------------|----------|-----------|----------|---------`);

    const entries = Object.keys(PROFILE_MS)
        .map(name => ({
            name,
            calls: PROFILE_COUNTERS[name] || 0,
            totalMs: PROFILE_MS[name] || 0
        }))
        .sort((a, b) => b.totalMs - a.totalMs);

    for (const entry of entries) {
        const avgMs = entry.calls > 0 ? entry.totalMs / entry.calls : 0;
        const pct = totalMs > 0 ? (entry.totalMs / totalMs * 100) : 0;
        const nameStr = entry.name.padEnd(30);
        const callStr = String(entry.calls).padStart(8);
        const totalStr = entry.totalMs.toFixed(3).padStart(9);
        const avgStr = avgMs.toFixed(4).padStart(8);
        const pctStr = pct.toFixed(1).padStart(7) + '%';
        console.log(`  ${nameStr} | ${callStr} | ${totalStr} | ${avgStr} | ${pctStr}`);
    }

    const avg = totalMs / frameTimes.length;
    const slowFrames = frameTimes.filter(x => x.ms > 5).sort((a, b) => b.ms - a.ms);
    console.log(`\n  Average per frame: ${avg.toFixed(3)}ms`);
    console.log(`  Slow frames (>5ms): ${slowFrames.length}`);
    if (slowFrames.length > 0) {
        console.log(`  Top slow frames:`);
        slowFrames.slice(0, 10).forEach(x => console.log(`    Frame ${x.frame}: ${x.ms.toFixed(3)}ms`));
    }
}

main().catch(e => { console.error(e); process.exit(1); });
