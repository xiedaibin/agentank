const fs = require('fs');
const path = require('path');

const replayDir = 'targeted_evolution_replays';
const files = fs.readdirSync(replayDir).filter(f => f.startsWith('loss_random_'));

console.log(`Analyzing ${files.length} random loss replays...`);
files.forEach(file => {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(replayDir, file), 'utf8'));
        const players = data.replayData.replay.meta.players;
        const result = data.replayData.replay.meta.result;
        
        // Find opponent ELO, name, and skill
        const XDB = players.find(p => p.tank.id === '2cd4fd74');
        const opponent = players.find(p => p.tank.id !== '2cd4fd74');
        
        const names = data.names || [];
        const XDBIndex = names.indexOf('XDB');
        const oppIndex = 1 - XDBIndex;
        const oppName = names[oppIndex] || "Unknown";
        
        const oppId = players[oppIndex].tank.id;
        let oppSkill = "unknown";
        for (let f = 0; f < records.length; f++) {
            const cast = records[f].find(e => e.sourceObjectId === oppId && e.action === 'cast');
            if (cast) {
                oppSkill = cast.skillType;
                break;
            }
        }
        
        console.log(`File: ${file}`);
        console.log(`  Opponent Name: ${oppName} | Skill: ${oppSkill}`);
        console.log(`  Winner: ${result.winner === XDBIndex ? 'XDB' : 'Opponent'} | Reason: ${result.reason}`);
    } catch (e) {
        console.error(e);
    }
});
