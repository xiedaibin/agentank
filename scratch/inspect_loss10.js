const fs = require('fs');
const path = require('path');

const filepath = path.join('replays', 'mat_FEH55lI7LfMDbhYEO_events.json');
if (!fs.existsSync(filepath)) {
    console.error("File not found:", filepath);
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
const events = data.events || [];

console.log("=== Last 30 events of loss_29 ===");
const lastEvents = events.slice(-30);
lastEvents.forEach(e => {
    console.log(`Frame ${e.frame}: [${e.event}] ${JSON.stringify(e)}`);
});
