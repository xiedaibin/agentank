const fs = require('fs');
const path = require('path');

const dir = 'targeted_evolution_replays';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

console.log(`Analyzing ${files.length} loss files...`);

files.forEach(f => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const replay = data.replayData?.replay || data.replay;
    if (!replay) return;
    
    const records = replay.records || [];
    const participants = data.participants;
    const isChallengerMe = participants.challenger.tankId === 230 || participants.challenger.tankName === 'XDB';
    const enemyIndex = isChallengerMe ? 1 : 0;
    const enemyTankId = replay.meta.players[enemyIndex].tank.id;
    
    // Find enemy teleport dest
    let teleportDest = null;
    let starPos = null;
    let mapId = data.replayData?.map?.id || 'unknown';
    
    // Find first star
    for (const frame of records) {
        for (const ev of frame) {
            if (ev.type === 'star' && ev.action === 'created') {
                starPos = ev.position || ev.at;
                break;
            }
        }
        if (starPos) break;
    }
    
    // Find enemy teleport
    for (const frame of records) {
        for (const ev of frame) {
            if (ev.sourceObjectId === enemyTankId && ev.type === 'skill' && ev.action === 'applied' && ev.skillType === 'teleport') {
                teleportDest = ev.to;
                break;
            }
        }
        if (teleportDest) break;
    }
    
    console.log(`Replay: ${f.replace('loss_3773_', '')} | Map: ${mapId} | Star: ${JSON.stringify(starPos)} | Enemy TP: ${JSON.stringify(teleportDest)}`);
});
