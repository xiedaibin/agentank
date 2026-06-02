const fs = require('fs');
const { getToken } = require('../config');

async function main() {
    const token = getToken();
    const testCode = `
function onIdle(me, enemy, game) {
    me.speak("Hello Frame " + game.frames);
    me.go();
}
`;

    console.log("Running speak simulation...");
    const res = await fetch('https://agentank.ai/api/agent/tank/simulate', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: testCode,
            opponentId: 'nova-scout',
            mapId: 'classic'
        })
    });
    
    if (!res.ok) {
        console.error("Error:", await res.text());
        return;
    }
    
    const data = await res.json();
    const replay = data.replayData || data;
    if (replay.replay && replay.replay.records) {
        const records = replay.replay.records;
        let found = 0;
        for (let f = 0; f < records.length; f++) {
            const frameEvents = records[f] || [];
            for (const ev of frameEvents) {
                // Look for anything containing "Hello" or speak/speech
                const str = JSON.stringify(ev);
                if (str.includes("Hello") || str.includes("speak") || str.includes("speech") || ev.text) {
                    console.log(`[Frame ${f}] Event:`, str);
                    found++;
                }
            }
        }
        console.log(`Found ${found} speech/speak-related events in records.`);
        if (found === 0) {
            // Save the first 3 frames to a file for inspect
            fs.writeFileSync('scratch/first_frames.json', JSON.stringify(records.slice(0, 5), null, 2));
            console.log("Saved first 5 frames to scratch/first_frames.json");
        }
    }
}

main();
