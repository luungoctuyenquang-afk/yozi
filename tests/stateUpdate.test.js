const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'state.js'), 'utf8');
const context = { window: {}, console };
vm.createContext(context);
const StateManager = new vm.Script(code + '\nStateManager').runInContext(context);

StateManager.set({});
StateManager.update('player.stats.score', 100);
const state = StateManager.get();

assert.strictEqual(state.player.stats.score, 100);
console.log('update creates nested objects:', JSON.stringify(state));

