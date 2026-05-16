const fs = require('fs');
const code = fs.readFileSync('new_tank.js', 'utf8');
const vm = require('vm');
try {
  new vm.Script(`function __wrapper__() {\n${code}\n}`);
  console.log('OK');
} catch (e) {
  console.error(e.stack);
}