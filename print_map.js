const fs = require('fs');
const data = JSON.parse(fs.readFileSync('targeted_evolution_replays/loss_3773_mat_E0AJEXGxj6R7wEQMf.json', 'utf8'));

console.log("participants:", JSON.stringify(data.participants, null, 2));
