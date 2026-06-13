const fs = require('fs');
const path = require('path');

// Manually parse .env
let token = "";
try {
    const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
    const match = envContent.match(/AGENTANK_TOKEN\s*=\s*([^\s]+)/);
    if (match) {
        token = match[1];
    }
} catch (e) {
    console.error("Failed to read .env file:", e.message);
}

if (!token) {
    console.error("Error: AGENTANK_TOKEN not found in .env");
    process.exit(1);
}

const code = `
function onIdle(me, enemy, game) {
    if (game.frames === 1) {
        print("--- SANDBOX INSPECTION ---");
        print("me keys:", Object.keys(me).join(", "));
        print("me.tank keys:", Object.keys(me.tank).join(", "));
        print("me.status keys:", me.status ? Object.keys(me.status).join(", ") : "null");
        print("enemy keys:", Object.keys(enemy).join(", "));
        if (enemy.tank) {
            print("enemy.tank keys:", Object.keys(enemy.tank).join(", "));
        }
        print("game keys:", Object.keys(game).join(", "));
    }
}
`;

async function main() {
    console.log("Sending simulation request...");
    const res = await fetch("https://agentank.ai/api/agent/tank/simulate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
            opponentId: "nova-scout",
            mapId: "classic",
            code: code
        })
    });

    if (!res.ok) {
        console.error(`Simulation failed with HTTP ${res.status}`);
        const text = await res.text();
        console.error(text);
        process.exit(1);
    }

    const data = await res.json();
    console.log("Simulation complete!");

    const rawReplayUrl = data.rawReplayUrl || (data.links && data.links.raw);
    if (!rawReplayUrl) {
        console.log("No raw replay URL found in response.");
        console.log(JSON.stringify(data, null, 2));
        process.exit(1);
    }

    console.log(`Fetching raw replay from ${rawReplayUrl}...`);
    const rawRes = await fetch(rawReplayUrl, {
        headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!rawRes.ok) {
        console.error(`Failed to fetch raw replay (HTTP ${rawRes.status})`);
        process.exit(1);
    }

    const rawData = await rawRes.json();
    const players = rawData.replayData.replay.meta.players;
    console.log("\n=== PLAYER LOGS ===");
    players.forEach((p, idx) => {
        console.log(`\nPlayer ${idx} (ID: ${p.tank ? p.tank.id : 'unknown'}):`);
        if (p.logs && p.logs.length > 0) {
            console.log(p.logs.join("\n"));
        } else {
            console.log("(no logs)");
        }
    });
}

main().catch(err => console.error(err));
