import { loadHarness, resolveHarnessRoot } from "./packages/cli/src/harness/loader";

const root = resolveHarnessRoot(".");
const h = loadHarness(root);
if (!h) { console.log("harness null"); process.exit(1); }

console.log("flows:", Object.keys(h.flows));
console.log("gates:", Object.keys(h.gates));
console.log("roles:", Object.keys(h.roles));
console.log("policies:", Object.keys(h.policies));

const stage = h.flows.sdlc.stages[2];
console.log("stage[2] gate field:", stage.gate);
console.log("lookup by base:", h.gates["human-approved-spec"]);
