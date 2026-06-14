const fs = require('fs');
const content = fs.readFileSync('replays/mat_EnDvq9PY90F82dLZK_events.json', 'utf8');
const data = JSON.parse(content);

const events = data.events || [];
const timeline = {};

events.forEach(e => {
    const f = e.frame;
    if (!timeline[f]) timeline[f] = [];
    timeline[f].push(e);
});

const frames = Object.keys(timeline).sort((a, b) => Number(a) - Number(b));

console.log("Timeline of Events:\n====================");
frames.forEach(f => {
    console.log(`\nFrame ${f}:`);
    timeline[f].forEach(e => {
        if (e.event === "star_spawned" || e.event === "star_collected") {
            console.log(`  🌟 [Star] ${e.event} at ${JSON.stringify(e.at || e.by)}`);
        } else if (e.event === "hit") {
            console.log(`  💥 [Hit] ${e.bulletOwner}'s bullet hit ${e.target} at ${JSON.stringify(e.at)}`);
        } else if (e.event === "fire") {
            console.log(`  🔫 [Fire] ${e.tank} fired a bullet`);
        } else if (e.event === "turn") {
            console.log(`  🔄 [Turn] ${e.tank} turned to ${e.direction}`);
        } else if (e.event === "go") {
            console.log(`  🏃 [Go] ${e.tank} moved forward (steps: ${e.steps})`);
        } else if (e.event === "teleport") {
            console.log(`  ✨ [Teleport] ${e.tank} teleported to ${JSON.stringify(e.to)}`);
        } else {
            console.log(`  ❓ [Event] ${e.event}: ${JSON.stringify(e)}`);
        }
    });
});
