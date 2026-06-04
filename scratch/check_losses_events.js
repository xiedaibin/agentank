const fs = require('fs');

const token = 'agtk_7fb88c28d1e140d654316c7ff1211d1418af';
const reportFile = 'evolution_report.json';

async function main() {
    if (!fs.existsSync(reportFile)) {
        console.error("evolution_report.json not found!");
        return;
    }
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    const matches = report.matches || [];
    console.log(`Checking all ${matches.length} matches from report for 'Star Suppression'...`);
    
    let totalTriggers = 0;
    
    for (const match of matches) {
        const urlId = match.matchUrlId;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const res = await fetch(`https://agentank.ai/api/matches/${urlId}/agent.json?view=events`, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!res.ok) {
                console.log(`Match ${urlId}: Failed to fetch events (HTTP ${res.status})`);
                continue;
            }
            const eventsData = await res.json();
            const events = eventsData.events || eventsData.records || [];
            
            let speakCount = 0;
            let suppressionCount = 0;
            
            events.forEach(evt => {
                const str = JSON.stringify(evt);
                if (str.includes('Suppression') || str.includes('suppression')) {
                    console.log(`  -> Found suppression event in match ${urlId} (${match.result} vs ${match.opponent}):`, evt);
                    suppressionCount++;
                    totalTriggers++;
                }
                if (evt.action === 'speak' || evt.type === 'speak' || str.includes('"speak"')) {
                    speakCount++;
                }
            });
            
            console.log(`Match ${urlId} (${match.result} vs ${match.opponent}): total events ${events.length}, speaks ${speakCount}, suppression triggers: ${suppressionCount}`);
        } catch (e) {
            console.error(`Error checking ${urlId}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log(`\nFinished checking. Total suppression triggers across all matches: ${totalTriggers}`);
}

main();
