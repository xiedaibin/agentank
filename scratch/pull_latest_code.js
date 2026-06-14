const fs = require('fs');
const { getToken } = require('../config');

async function pullLatestCode() {
    const token = getToken();
    if (!token) {
        console.error("Error: Token not found.");
        process.exit(1);
    }
    
    console.log("Fetching tank context from API...");
    try {
        const res = await fetch('https://agentank.ai/api/agent/tank', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        
        if (data.latestCode) {
            fs.writeFileSync('new_tank_latest.js', data.latestCode);
            console.log("Saved latest compiled code to new_tank_latest.js");
        } else {
            console.log("No latestCode in response.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

pullLatestCode();
