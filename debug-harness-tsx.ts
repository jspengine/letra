import { loadHarness, resolveHarnessRoot } from './packages/cli/src/harness/loader.js';
import { parseSimpleYaml } from './packages/cli/src/harness/parse.js';
import { readFileSync } from 'node:fs';

const root = process.cwd();
const hRoot = resolveHarnessRoot(root);
console.log('hRoot:', hRoot);
const h = loadHarness(hRoot);
console.log('has sdlc:', !!h?.flows?.sdlc);
const sdlc = h?.flows?.sdlc;
const sr = sdlc?.stages?.find((s: any) => s.id === 'spec-review');
console.log('spec-review stage:', sr);
if (sr?.gate) {
  const gateId = sr.gate.replace(/^.*[\\/]/, '').replace(/\.yaml$/, '');
  console.log('gateId:', gateId);
  console.log('gate:', h?.gates?.[gateId]);
}
