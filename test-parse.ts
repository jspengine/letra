import { parseSimpleYaml } from './packages/cli/src/harness/parse.js';
import { readFileSync } from 'node:fs';

const text = readFileSync('.letra/harness/v0.1.0/flows/sdlc.yaml', 'utf-8');
const data = parseSimpleYaml(text);
console.log(JSON.stringify(data, null, 2));
