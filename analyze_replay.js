const fs = require('fs');

async function analyze(input) {
    try {
        let data;
        if (input.startsWith('http')) {
            console.log("Fetching URL:", input);
            const res = await fetch(input);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            data = await res.json();
        } else {
            console.log("Reading local file:", input);
            const content = fs.readFileSync(input, 'utf8');
            data = JSON.parse(content);
        }
        console.log("Participants:", JSON.stringify(data.participants, null, 2));
        console.log("Data keys:", Object.keys(data));
        const frames = data.replayData.replay.records;
        console.log("Frames count:", frames.length);
        for (let i = 0; i < Math.min(frames.length, 10); i++) {
            console.log(`Frame ${i}:`, JSON.stringify(frames[i]));
        }
        for (let i = Math.max(0, frames.length - 5); i < frames.length; i++) {
            console.log(`Frame ${i}:`, JSON.stringify(frames[i]));
        }
    } catch (e) {
        console.error("Analysis Error:", e);
    }
}

const url = process.argv[2];
if (!url) {
    console.error("Usage: node analyze_replay.js <url>");
    process.exit(1);
}
analyze(url).catch(console.error);