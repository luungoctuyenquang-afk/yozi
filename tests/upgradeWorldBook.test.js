const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
const context = { window: {}, console };
vm.createContext(context);
const Utils = new vm.Script(code + '\nUtils').runInContext(context);

const result = Utils.upgradeWorldBook([
  { id: 'rule0', key: 'rule0', value: 0 }
]);

assert.strictEqual(result[0].value, 0);
console.log('upgradeWorldBook preserves zero value:', result[0].value);
