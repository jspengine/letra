import { createServer } from "node:http";
import { loadHarness, resolveHarnessRoot } from "./packages/cli/src/harness/loader.js";

const hRoot = resolveHarnessRoot(".");
const h = loadHarness(hRoot);

const server = createServer((req, res) => {
  console.log("REQ:", req.method, req.url);
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/api/test-gate") {
    const template = h?.flows?.sdlc;
    const targetStage = template?.stages.find((s: any) => s.id === "spec-review");
    const gateId = targetStage?.gate?.replace(/^.*[\\/]/, "").replace(/\.yaml$/, "");
    const gate = h?.gates?.[gateId];
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ hasHarness: !!h, hasTemplate: !!template, gate, gateId }));
  } else {
    res.writeHead(404);
    res.end("not found");
  }
});

server.listen(3005, () => console.log("debug server on 3005"));
