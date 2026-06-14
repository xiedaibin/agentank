const { getToken } = require('../config');
const fs = require('fs');

async function getCodeByVersion(version) {
    const token = getToken();
    const url = `https://agentank.ai/api/agent/tank?version=${version}`;
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            return data.latestCode;
        }
    } catch (e) {
        console.error(`Error version ${version}:`, e.message);
    }
    return null;
}

async function main() {
    for (let v = 336; v >= 300; v--) {
        const code = await getCodeByVersion(v);
        if (code) {
            const lines = code.split('\n');
            const header = lines.slice(0, 6).join('\n');
            console.log(`Version ${v} header snippet: ${header.replace(/\r/g, '').replace(/\n/g, ' | ')}`);
            if (header.includes("V12.59")) {
                console.log(`Found V12.59! Version code: ${v}`);
                fs.writeFileSync('new_tank_v12_59.js', code);
                console.log("Saved V12.59 to new_tank_v12_59.js");
                break;
            }
        }
    }
}
main();
