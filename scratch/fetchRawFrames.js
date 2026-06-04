const { getToken } = require('../config');
const token = getToken();
if (!token) {
    console.error("Error: AGENTANK_TOKEN not found in environment or .env file.");
    process.exit(1);
}
const matchId = 'mat_6kLuYxxXbWv3yvOkN';


async function main() {
    const res = await fetch(`https://agentank.ai/api/matches/${matchId}/agent/frames?from=1&to=20`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await res.json();
    const frames = data.frames || [];
    
    frames.forEach(f => {
        if (f.events) {
            f.events.forEach(e => {
                if (e.type === 'speech' && e.text) {
                    console.log(`Frame ${f.frame}: Tank spoke "${e.text}" at position ${JSON.stringify(e.position)}`);
                }
            });
        }
    });
}

main();
