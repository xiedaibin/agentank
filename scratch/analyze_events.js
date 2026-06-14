const fs = require('fs');

const files = [
    'mat_BchXi69ZgmmIaFfM9_events.json',
    'mat_3JCDqDQhroU22Okp4_events.json',
    'mat_9fsqxd46RbvGN8hfj_events.json',
    'mat_HA15QlCkQrC8xCiTy_events.json',
    'mat_KcCJShJx0PNB63nPY_events.json'
];

files.forEach(file => {
    if (!fs.existsSync(file)) {
        console.log(`File ${file} does not exist.`);
        return;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const events = data.events || [];
    
    console.log(`\n============================`);
    console.log(`File: ${file}`);
    console.log(`Total events: ${events.length}`);
    
    // 过滤出最后 15 个事件
    const lastEvents = events.slice(-15);
    console.log("Last 15 events:");
    lastEvents.forEach(evt => {
        if (evt.event === 'crashed') {
            console.log(`  [F${evt.frame}] 💥 Crashed: ${evt.tank} by ${evt.by}`);
        } else if (evt.event === 'move') {
            console.log(`  [F${evt.frame}] Move: ${evt.tank} to ${JSON.stringify(evt.to)}`);
        } else if (evt.event === 'turn') {
            console.log(`  [F${evt.frame}] Turn: ${evt.tank} to ${evt.direction}`);
        } else if (evt.event === 'fire') {
            console.log(`  [F${evt.frame}] 🔥 Fire: ${evt.tank} dir ${evt.direction}`);
        } else if (evt.event === 'skill_cast') {
            console.log(`  [F${evt.frame}] Skill: ${evt.tank} cast ${evt.skill}`);
        } else if (evt.event === 'skill_applied') {
            console.log(`  [F${evt.frame}] Skill: ${evt.tank} applied ${evt.skill} to ${JSON.stringify(evt.to)}`);
        } else if (evt.event === 'star_collected') {
            console.log(`  [F${evt.frame}] ⭐ Star collected: ${evt.tank}`);
        } else if (evt.event === 'shot_hit') {
            console.log(`  [F${evt.frame}] Bullet hit: ${evt.tank}`);
        } else {
            console.log(`  [F${evt.frame}] Event: ${evt.event} details: ${JSON.stringify(evt)}`);
        }
    });
});
