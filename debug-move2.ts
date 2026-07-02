import { loadWorkflow } from './packages/cli/src/commands/flow-init.js';
import { loadHarness, resolveHarnessRoot } from './packages/cli/src/harness/loader.js';

async function test() {
  const root = '.';
  const workflow = loadWorkflow(root);
  const item = workflow?.items.find(i => i.id.toLowerCase() === 'item-5'.toLowerCase());
  console.log('item found:', !!item);
  console.log('item stage:', item?.stage);

  const targetStageInput = 'spec-review';
  const targetStageId = targetStageInput;
  console.log('targetStageId:', targetStageId);

  const harness = loadHarness(resolveHarnessRoot(root));
  const template = harness?.flows?.sdlc;
  console.log('template found:', !!template);
  const targetDef = template?.stages?.find(s => s.id === targetStageId);
  console.log('targetDef:', targetDef);
  console.log('targetDef.gate:', targetDef?.gate);

  if (targetDef?.gate) {
    const gateId = targetDef.gate.replace(/^.*[\\/]/, '').replace(/\.yaml$/, '');
    console.log('gateId:', gateId);
    const gate = harness?.gates?.[gateId];
    console.log('gate:', gate);
  }
}

test().catch(console.error);
