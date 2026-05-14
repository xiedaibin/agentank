const fs = require('fs');

async function analyze(url) {
    try {
        console.log("Fetching:", url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        console.log("Data keys:", Object.keys(data));
        const frames = data.replayData.replay.records;
        console.log("Frames count:", frames.length);
        console.log("First frame:", JSON.stringify(frames[0]).substring(0, 500));
        console.log("Last frame:", JSON.stringify(frames[frames.length - 1]).substring(0, 500));
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