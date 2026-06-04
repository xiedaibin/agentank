const fs = require('fs');
const path = require('path');

function decodeEntities(encodedString) {
  const translate_re = /&(nbsp|amp|quot|lt|gt|#39|#34|#43);/g;
  const translate = {
    "nbsp": " ",
    "amp": "&",
    "quot": "\"",
    "lt": "<",
    "gt": ">",
    "#39": "'",
    "#34": "\"",
    "#43": "+"
  };
  return encodedString.replace(translate_re, function(match, entity) {
    return translate[entity];
  }).replace(/&#(\d+);/gi, function(match, numStr) {
    const num = parseInt(numStr, 10);
    return String.fromCharCode(num);
  });
}

async function syncRules() {
  try {
    console.log("Fetching 1v1 agent guide...");
    const guideRes = await fetch("https://agentank.ai/agent-guide");
    let guideText = await guideRes.text();
    
    // Check if it's HTML or raw text/markdown
    if (guideText.includes("<pre") && guideText.includes("<code>")) {
      const match = guideText.match(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/);
      if (match) {
        guideText = decodeEntities(match[1]);
      }
    }
    fs.writeFileSync(path.join(__dirname, "../AGENT_GUIDE.md"), guideText.trim() + "\n");
    console.log("AGENT_GUIDE.md updated successfully.");

    console.log("Fetching multiplayer agent guide...");
    const multiRes = await fetch("https://agentank.ai/battle-rooms/multiplayer-agent-guide");
    let multiText = await multiRes.text();
    
    if (multiText.includes("<pre") && multiText.includes("<code>")) {
      const match = multiText.match(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/);
      if (match) {
        multiText = decodeEntities(match[1]);
      }
    }
    fs.writeFileSync(path.join(__dirname, "../MULTIPLAYER-AGENT-GUIDE.md"), multiText.trim() + "\n");
    console.log("MULTIPLAYER-AGENT-GUIDE.md updated successfully.");

  } catch (error) {
    console.error("Error syncing rules:", error);
    process.exit(1);
  }
}

syncRules();
