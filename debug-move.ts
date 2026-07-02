import { loadWorkflow } from './packages/cli/src/commands/flow-init.js';
import { flowMove } from './packages/cli/src/commands/flow-move.js';

const wf = loadWorkflow('.');
console.log('items before:', wf?.items.map(i => ({ id: i.id, stage: i.stage })));

flowMove('.', 'ITEM-1', 'spec-review', { force: true }).then(() => {
  const wf2 = loadWorkflow('.');
  console.log('items after:', wf2?.items.map(i => ({ id: i.id, stage: i.stage })));
});
