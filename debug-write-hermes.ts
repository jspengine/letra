import { generateHermesAdapter } from './packages/cli/src/adapters/hermes.js';
import { writeFileSync } from 'node:fs';

const content = generateHermesAdapter('.');
if (content) {
  writeFileSync('.hermes/instructions.md', content, 'utf-8');
  console.log('Adatper Hermes gerado em .hermes/instructions.md');
} else {
  console.log('Nenhum workflow encontrado.');
}
