const fs = require('fs');

const file = 'mat_INgHSVPJZ7vGLl0SK_events.json';
if (!fs.existsSync(file)) {
    console.log(`File ${file} does not exist.`);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log("Participants:");
console.log(JSON.stringify(data.participants, null, 2));

const events = data.events || [];
console.log(`\nTotal events: ${events.length}`);

// 找出我们是哪一个坦克。
// XDB 的坦克 ID 是 230，或者我们可以看名字
const ourTankId = '230'; // 或者可以通过 data.participants 找出哪个是 xiedaibin/agentank

// 打印所有事件，包括每帧的状态
events.forEach(evt => {
    let details = '';
    if (evt.event === 'crashed') {
        details = `💥 Crashed: ${evt.tank} by ${evt.by}`;
    } else if (evt.event === 'move') {
        details = `Move: ${evt.tank} to ${JSON.stringify(evt.to)}`;
    } else if (evt.event === 'turn') {
        details = `Turn: ${evt.tank} to ${evt.direction}`;
    } else if (evt.event === 'fire') {
        details = `🔥 Fire: ${evt.tank} dir ${evt.direction}`;
    } else if (evt.event === 'skill_cast') {
        details = `Skill: ${evt.tank} cast ${evt.skill} params ${JSON.stringify(evt.params)}`;
    } else if (evt.event === 'skill_applied') {
        details = `Skill: ${evt.tank} applied ${evt.skill} to ${JSON.stringify(evt.to)}`;
    } else if (evt.event === 'star_collected') {
        details = `⭐ Star collected: ${evt.tank}`;
    } else if (evt.event === 'shot_hit') {
        details = `Bullet hit: ${evt.tank}`;
    } else if (evt.event === 'speak') {
        details = `🗣️ ${evt.tank} speak: "${evt.text}"`;
    } else {
        details = `${evt.event}: ${JSON.stringify(evt)}`;
    }
    console.log(`[F${evt.frame}] ${details}`);
});
