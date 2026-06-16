const fs = require('fs');
const path = require('path');

async function main() {
    const dir = 'batch_evolution_replays';
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('raw_'));
    
    console.log(`Found ${files.length} loss matches.`);
    
    for (let file of files) {
        const filePath = path.join(dir, file);
        const compactData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const matchId = compactData.match.urlId;
        const opponent = compactData.match.winnerTankName;
        
        // 抓取 raw
        const rawPath = `raw_${matchId}.json`;
        let rawData;
        if (!fs.existsSync(rawPath)) {
            const url = `http://agentank.ai/api/matches/${matchId}/agent.json?view=raw`;
            console.log(`Fetching raw for ${matchId} (vs ${opponent})...`);
            const res = await fetch(url);
            if (!res.ok) {
                console.error(`Failed to fetch ${matchId}`);
                continue;
            }
            rawData = await res.json();
            fs.writeFileSync(rawPath, JSON.stringify(rawData, null, 2));
        } else {
            rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
        }
        
        // 解析
        const records = rawData.replayData.replay.records;
        let myId = null;
        for (let i = 0; i < records.length; i++) {
            const events = records[i];
            for (let e of events) {
                if (e.type === "speech" && e.text.includes("预判")) {
                    myId = e.objectId;
                }
            }
        }
        
        if (!myId) {
            // fallback search for ID 230
            for (let i = 0; i < records.length; i++) {
                const events = records[i];
                for (let e of events) {
                    if (e.tank && e.tank.id === "230") {
                        myId = e.objectId;
                    }
                }
            }
        }
        
        let blockedCount = 0;
        let blockedAxCount = 0;
        let blockedTurnCount = 0;
        let crashFrame = -1;
        let totalFrames = records.length;
        
        for (let i = 0; i < records.length; i++) {
            const events = records[i];
            for (let e of events) {
                if (e.type === "speech" && e.objectId === myId) {
                    if (e.text === "阻断偏轴") blockedAxCount++;
                    if (e.text === "阻断变向") blockedTurnCount++;
                    if (e.text.includes("阻断")) blockedCount++;
                }
                if (e.type === "crashed" && e.tank && (e.objectId === myId || e.tank.id === myId)) {
                    crashFrame = i;
                }
            }
        }
        
        console.log(`Match ${matchId} (vs ${opponent}): Total Frames: ${totalFrames} | Blocked OffAxis: ${blockedAxCount} | Blocked Turn: ${blockedTurnCount} | Crashed: ${crashFrame !== -1 ? `At Frame ${crashFrame}` : 'No'}`);
    }
}

main().catch(console.error);
