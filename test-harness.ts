import { loadHarness, resolveHarnessRoot } from "./packages/cli/src/harness/loader.js";
import { readFileSync } from "node:fs";

const root = resolveHarnessRoot(process.cwd());
const manifest = loadHarness(root);

console.log("root:", root);
console.log("flows:", Object.keys(manifest?.flows ?? {}));
console.log("gates:", Object.keys(manifest?.gates ?? {}));
console.log("roles:", Object.keys(manifest?.roles ?? {}));
console.log("policies:", Object.keys(manifest?.policies ?? {}));

if (manifest?.gates["human-approved-spec"]) {
  console.log("sample gate:", JSON.stringify(manifest.gates["human-approved-spec"], null, 2));
}
if (manifest?.roles["analyst"]) {
  console.log("sample role:", JSON.stringify(manifest.roles["analyst"], null, 2));
}
if (manifest?.policies["sdlc-default"]) {
  console.log("sample policy keys:", Object.keys(manifest.policies["sdlc-default"]));
}
