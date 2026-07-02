import { loadWorkflow } from './packages/cli/src/commands/flow-init.js';
const wf = loadWorkflow('.');
console.log('items count:', wf?.items.length);
console.log('item ids:', wf?.items.map(i => i.id));
console.log('search item-1:', wf?.items.find(i => i.id.toLowerCase() === 'item-1'.toLowerCase())?.id);
