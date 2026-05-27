const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scratch/sim_result.json', 'utf8'));

// Recursively search for any string containing "inspection" or "error" or "keys"
function search(obj, path = '') {
    if (typeof obj === 'string') {
        if (obj.toLowerCase().includes('inspect') || obj.toLowerCase().includes('error') || obj.toLowerCase().includes('keys') || obj.toLowerCase().includes('stars')) {
            console.log(`Found string at ${path}: "${obj}"`);
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((item, idx) => search(item, `${path}[${idx}]`));
    } else if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
            if (key.toLowerCase().includes('log') || key.toLowerCase().includes('print') || key.toLowerCase().includes('err')) {
                console.log(`Found key "${key}" at ${path}.${key}:`, obj[key]);
            }
            search(obj[key], `${path}.${key}`);
        });
    }
}

search(data);
