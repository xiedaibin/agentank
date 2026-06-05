const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    if (!token) {
        console.error("Error: Token not found.");
        return;
    }

    const matchId = 'mat_JE6HpiKYL071kNivD';
    const url = `https://agentank.ai/api/matches/${matchId}/agent.json?view=raw`;

    console.log(`Fetching raw replay for ${matchId}...`);
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            console.error(`Fetch failed: Status ${res.status}: ${await res.text()}`);
            return;
        }
        const data = await res.json();
        console.log("Successfully fetched replay JSON.");
        
        let map = data.replayData && data.replayData.map && data.replayData.map.map;

        if (!map) {
            console.error("Could not find map array in replay.");
            return;
        }

        console.log(`Map dimensions: Width = ${map.length}, Height = ${map[0].length}`);
        
        // Let's import the analyzeMap function logic from new_tank.js
        const code = fs.readFileSync('new_tank.js', 'utf8');
        
        // Simple extraction of analyzeMap and helper functions to run locally
        const vm = require('vm');
        const sandbox = {
            map: map,
            console: console,
            Math: Math
        };
        const script = new vm.Script(code + `
            const result = analyzeMap(map);
            console.log("\\n=== ANALYSIS RESULTS ===");
            console.log("Width:", result.width, "Height:", result.height);
            console.log("Trapped cells count:", Object.keys(result.trapped).length);
            console.log("Trapped cells list:", Object.keys(result.trapped));
            
            // Draw the map and highlight trapped cells
            console.log("\\n=== MAP VISUALIZATION (T = Trapped cell, x = wall, m = mound, o = grass, . = empty) ===");
            for (let y = 0; y < result.height; y++) {
                let row = "";
                for (let x = 0; x < result.width; x++) {
                    const tileKey = x + "," + y;
                    const originalTile = map[x][y];
                    if (result.trapped[tileKey]) {
                        row += "T ";
                    } else {
                        row += originalTile + " ";
                    }
                }
                console.log(row);
            }
        `);
        const context = vm.createContext(sandbox);
        script.runInContext(context);

    } catch (e) {
        console.error("Error occurred:", e);
    }
}

main();
