import { buildHarnessSnapshot } from './packages/cli/src/adapters/builder.js';
import { formatAdapterContent } from './packages/cli/src/adapters/formatters.js';
import { loadWorkflow } from './packages/cli/src/commands/flow-init.js';

const workflow = loadWorkflow('.');
if (!workflow) {
  console.log('Nenhum workflow encontrado em .letra/workflow.json');
  process.exit(1);
}

const snapshot = buildHarnessSnapshot('.', {
  workflow,
  activeStageId: workflow.items[0]?.stage || workflow.stages[0]?.id,
});

const content = formatAdapterContent(snapshot, 'text', {
  source: 'hermes',
  displayName: 'Hermes Agent',
});

console.log(content);
