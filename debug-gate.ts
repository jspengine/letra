import { loadHarness, resolveHarnessRoot } from './packages/cli/src/harness/loader.js';
const h = loadHarness(resolveHarnessRoot('.'));
const stage = h?.flows?.sdlc?.stages?.find((s: any) => s.id === 'spec-review');
console.log('stage gate:', stage?.gate);
const gateId = stage?.gate?.replace(/^.*[\\/]/, '').replace(/\.yaml$/, '');
console.log('gateId:', gateId);
console.log('gate:', h?.gates?.[gateId]);
