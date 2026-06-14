const { getToken } = require('../config');

async function testPath(path) {
    const token = getToken();
    const url = `https://agentank.ai/api${path}`;
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            console.log(`Success on ${path}:`, typeof data, Array.isArray(data) ? `Array length ${data.length}` : `Keys: ${Object.keys(data)}`);
            if (data.latestCode || data.code) {
                console.log("Found code!");
                return data;
            }
        } else {
            console.log(`Failed on ${path}: HTTP ${res.status}`);
        }
    } catch (e) {
        console.log(`Error on ${path}:`, e.message);
    }
    return null;
}

async function main() {
    const paths = [
        '/agent/tank?version=335',
        '/agent/tank?version=334',
        '/agent/tank/code?version=335',
        '/agent/tank/code/335',
        '/agent/tank/version/335',
        '/agent/tank/code-version/335',
        '/agent/tank/code-branch/main?version=335'
    ];
    for (const p of paths) {
        await testPath(p);
    }
}
main();
