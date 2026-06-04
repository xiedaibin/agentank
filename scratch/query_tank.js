const { getToken } = require('../config');
const fs = require('fs');
const path = require('path');

async function main() {
    const token = getToken();
    const res = await fetch('https://agentank.ai/api/agent/tank', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    fs.writeFileSync(path.join(__dirname, 'query_tank_res.json'), JSON.stringify(data, null, 2));
    console.log("Done");
}

main();
