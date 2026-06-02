const { getToken } = require('../config');

async function main() {
    const token = getToken();
    const opponentId = 1414; // Taoqi
    const res = await fetch(`https://agentank.ai/api/agent/opponents?q=${opponentId}&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await res.json();
    const opp = data.opponents[0];
    console.log("Opponent Name:", opp.name);
    console.log("Opponent SkillType:", opp.skillType || opp.skill || "not found in main object");
    console.log("Keys of opponent:", Object.keys(opp));
}

main();
