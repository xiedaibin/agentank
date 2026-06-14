const { getToken } = require('../config');
const fs = require('fs');

async function main() {
    const token = getToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    try {
        const res = await fetch('https://agentank.ai/api/agent/tank', { headers });
        const data = await res.json();
        console.log("codeBranches:", JSON.stringify(data.codeBranches, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}
main();
