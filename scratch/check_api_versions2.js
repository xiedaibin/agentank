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
            if (JSON.stringify(data).includes('V12.59') || JSON.stringify(data).includes('335')) {
                console.log(`FOUND V12.59/335 content in ${path}`);
            }
            return data;
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
        '/agent/tank/code/versions',
        '/agent/tank/code-versions',
        '/agent/tank/commits',
        '/agent/tank/code-commits',
        '/agent/tank/tnk_9arhtgIxusOKvbI5s/code',
        '/agent/tank/tnk_9arhtgIxusOKvbI5s/versions',
        '/agent/tank/tnk_9arhtgIxusOKvbI5s/history',
        '/agent/tank/code?version=335',
        '/agent/tank/code?codeVersion=335',
        '/agent/tank/code?v=335'
    ];
    for (const p of paths) {
        await testPath(p);
    }
}
main();
