const fs = require('fs');
const path = require('path');

const sourcePath = `C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\54bbfdc8-5ce7-4bf8-a7e6-014f405024ba\\.system_generated\\steps\\11\\content.md`;
const targetPath = `d:\\MyGit\\agentank\\MULTIPLAYER-AGENT-GUIDE.md`;

let content = fs.readFileSync(sourcePath, 'utf8');

// Find the code section
const startTag = '<pre class="agent-guide-content"><code>';
const endTag = '</code></pre>';

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find code block in the content!');
  process.exit(1);
}

let codeContent = content.substring(startIndex + startTag.length, endIndex);

// Decode basic HTML entities
codeContent = codeContent
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&#43;/g, '+');

fs.writeFileSync(targetPath, codeContent, 'utf8');
console.log('Successfully decoded and written to MULTIPLAYER-AGENT-GUIDE.md');
