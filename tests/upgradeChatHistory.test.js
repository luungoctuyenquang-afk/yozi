const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
const context = { window: {}, console };
vm.createContext(context);
const Utils = new vm.Script(code + '\nUtils').runInContext(context);

const records = [
  { sender: 'ai', content: '<thinking>plan</thinking>answer' },
  { sender: 'user', content: 'hi' }
];

const upgraded = Utils.upgradeChatHistory(records);

assert.strictEqual(upgraded[0].content.length, 1);
assert.strictEqual(upgraded[0].content[0].text, 'answer');
assert.strictEqual(upgraded[0].thoughtText, 'plan');
assert.strictEqual(upgraded[1].content.length, 1);
assert.strictEqual(upgraded[1].content[0].text, 'hi');
assert.strictEqual(upgraded[1].thoughtText, '');

console.log('upgradeChatHistory:', JSON.stringify(upgraded));
