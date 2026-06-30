const https = require('https');
const fs = require('fs');
const path = require('path');
const { getToken } = require('../config');

const token = getToken();
const matchId = process.argv[2] || 'mat_6Dl3239ZLE20e9AaR';

function download(url, filePath) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to get '${url}' (Status Code: ${res.statusCode})`));
                return;
            }
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                fs.writeFileSync(filePath, data);
                resolve();
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function run() {
    const scratchDir = __dirname;
    console.log(`Downloading summary for ${matchId}...`);
    await download(`https://agentank.ai/api/matches/${matchId}/agent.json`, path.join(scratchDir, `${matchId}_summary.json`));
    console.log(`Downloading raw for ${matchId}...`);
    await download(`https://agentank.ai/api/matches/${matchId}/agent.json?view=raw`, path.join(scratchDir, `${matchId}_raw.json`));
    console.log("Done!");
}

run().catch(console.error);
