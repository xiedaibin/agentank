const { getToken } = require('../config');
const token = getToken();
if (!token) {
    console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
    process.exit(1);
}


async function main() {
    const res = await fetch('https://agentank.ai/api/agent/leaderboard?period=all&sort=score&limit=5', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

main();
