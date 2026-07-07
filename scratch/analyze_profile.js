const fs = require('fs');

const profilePath = 'CPU.20260708.012255.24396.0.001.cpuprofile';
if (!fs.existsSync(profilePath)) {
    console.error("Profile file not found.");
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const nodes = data.nodes || [];

const functionHits = {};
for (const node of nodes) {
    const fn = node.callFrame.functionName || '(anonymous)';
    const hits = node.hitCount || 0;
    if (hits > 0) {
        functionHits[fn] = (functionHits[fn] || 0) + hits;
    }
}

const sorted = Object.entries(functionHits).sort((a, b) => b[1] - a[1]);
console.log("=== CPU PROFILE FUNCTION HOTSPOTS ===");
sorted.slice(0, 15).forEach(([fn, hits]) => {
    console.log(`  ${fn.padEnd(30)}: ${hits} hits`);
});
