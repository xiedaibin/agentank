const { execSync } = require('child_process');

try {
    const output = execSync('node summarize_rank_losses.js').toString();
    const summary = JSON.parse(output);
    const stats = {};

    summary.cases.forEach(c => {
        const name = c.enemyName;
        if (!stats[name]) {
            stats[name] = { killed: 0, timeout: 0, total: 0 };
        }
        stats[name].total++;
        if (c.deathReason === 'Killed') {
            stats[name].killed++;
        } else {
            stats[name].timeout++;
        }
    });

    const sorted = Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
    console.log('--- Detailed Loss Statistics by Opponent ---');
    console.log('Total | Killed | Timeout | Opponent');
    console.log('---------------------------------------');
    sorted.forEach(([name, s]) => {
        console.log(`${s.total.toString().padStart(5)} | ${s.killed.toString().padStart(6)} | ${s.timeout.toString().padStart(7)} | ${name}`);
    });
} catch (e) {
    console.error("Error analyzing losses:", e);
}
