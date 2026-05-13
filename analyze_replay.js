const fs = require('fs');

async function analyze(url) {
    try {
        console.log("Fetching:", url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log("Data keys:", Object.keys(data));
        const frames = data.replayData.replay.records;
        console.log("Frames count:", frames.length);
        const lastFrames = frames.slice(-5);
        lastFrames.forEach(f => {
            if (!f.game) return;
            console.log(`Frame ${f.frame}:`);
            console.log(`  Me: pos=${f.game.me.tank.position}, dir=${f.game.me.tank.direction}`);
            if (f.game.enemy && f.game.enemy.tank) {
                 console.log(`  Enemy: pos=${f.game.enemy.tank.position}, dir=${f.game.enemy.tank.direction}, skill=${f.game.enemy.skill ? f.game.enemy.skill.type : 'none'}, effects=${JSON.stringify(f.game.enemy.effects || [])}`);
            } else {
                 console.log(`  Enemy: Not visible`);
            }
            if (f.game.bullet) console.log(`  Bullet: pos=${f.game.bullet.position}, dir=${f.game.bullet.direction}`);
            console.log(`  Action Taken:`, f.action);
        });
    } catch (e) {
        console.error("Analysis Error:", e);
    }
}

const url = process.argv[2];
if (!url) {
    console.error("Usage: node analyze_replay.js <url>");
    process.exit(1);
}
analyze(url).catch(console.error);