import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { loadHarness } from "./loader.js";

const roots: string[] = [];

function tempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-harness-"));
	roots.push(root);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("HarnessLoader v0.2.0", () => {
	it("loads roles with handoff config", () => {
		const root = tempRoot();
		const harnessDir = join(root, "harness", "v0.2.0");
		mkdirSync(join(harnessDir, "roles"), { recursive: true });
		mkdirSync(join(harnessDir, "gates"), { recursive: true });
		mkdirSync(join(harnessDir, "flows"), { recursive: true });

		writeFileSync(join(harnessDir, "roles", "analyst.yaml"), `
id: analyst
label: Analyst
description: Analyzes specs
allowedStages:
  - design
capabilities:
  - read_code
handoff:
  blocksHandoff: false
  allowedTargets:
    - implementer
  requireEvidence: true
  ttlMinutes: 30
`);

		writeFileSync(join(harnessDir, "gates", "spec-approved.yaml"), `
id: spec-approved
name: Spec Approved
type: human
blocking: true
blocksHandoff: true
description: Human approves spec
`);

		writeFileSync(join(harnessDir, "flows", "flow-main.yaml"), `
id: flow-main
version: "0.2.0"
name: Main Flow
description: Test flow
defaultPolicy: sdlc-default
stages:
  - id: design
    name: Design
    order: 0
    description: Design stage
    agents:
      - analyst
    gate: spec-approved
    preferredExecutor: opencode
`);

		const manifest = loadHarness(harnessDir);
		expect(manifest).not.toBeNull();
		expect(manifest!.roles.analyst).toMatchObject({
			id: "analyst",
			handoff: {
				blocksHandoff: false,
				allowedTargets: ["implementer"],
				requireEvidence: true,
				ttlMinutes: 30,
			},
		});
		expect(manifest!.gates["spec-approved"]).toMatchObject({
			id: "spec-approved",
			blocksHandoff: true,
		});
		expect(manifest!.flows["flow-main"]!.stages[0]).toMatchObject({
			preferredExecutor: "opencode",
		});
	});

	it("loads executor registry", () => {
		const root = tempRoot();
		const harnessDir = join(root, "harness", "v0.2.0");
		mkdirSync(join(harnessDir, "roles"), { recursive: true });
		mkdirSync(join(harnessDir, "gates"), { recursive: true });
		mkdirSync(join(harnessDir, "flows"), { recursive: true });
		mkdirSync(join(harnessDir, "executors"), { recursive: true });

		writeFileSync(join(harnessDir, "executors", "registry.yaml"), `
executors:
  - id: opencode
    label: OpenCode
    capabilities:
      - code
      - review
    notification:
      - sse
      - polling
    heartbeat: true
    maxExecutionTime: 1800
    priority: 1

  - id: cursor
    label: Cursor
    capabilities:
      - code
    notification:
      - file-watch
    heartbeat: false
    maxExecutionTime: 3600
    priority: 2

stageExecutorPreferences:
  design:
    - opencode
  code:
    - opencode
    - cursor
`);

		writeFileSync(join(harnessDir, "roles", "builder.yaml"), `
id: builder
label: Builder
description: Builds
allowedStages:
  - code
capabilities:
  - code
`);

		writeFileSync(join(harnessDir, "gates", "all-acs-passing.yaml"), `
id: all-acs-passing
name: All ACs Passing
type: automated
blocking: true
description: All ACs must pass
`);

		writeFileSync(join(harnessDir, "flows", "flow-main.yaml"), `
id: flow-main
version: "0.2.0"
name: Main
description: Test
defaultPolicy: sdlc-default
stages:
  - id: code
    name: Code
    order: 0
    description: Code
    agents:
      - builder
    gate: all-acs-passing
`);

		const manifest = loadHarness(harnessDir);
		expect(manifest).not.toBeNull();
		expect(manifest!.executors).toBeDefined();
		expect(manifest!.executors!.executors).toHaveLength(2);
		expect(manifest!.executors!.executors[0]).toMatchObject({
			id: "opencode",
			heartbeat: true,
			priority: 1,
		});
		expect(manifest!.executors!.stageExecutorPreferences).toMatchObject({
			design: ["opencode"],
			code: ["opencode", "cursor"],
		});
	});

	it("handles missing handoff config gracefully", () => {
		const root = tempRoot();
		const harnessDir = join(root, "harness", "v0.2.0");
		mkdirSync(join(harnessDir, "roles"), { recursive: true });
		mkdirSync(join(harnessDir, "gates"), { recursive: true });
		mkdirSync(join(harnessDir, "flows"), { recursive: true });

		writeFileSync(join(harnessDir, "roles", "builder.yaml"), `
id: builder
label: Builder
description: Builds
allowedStages:
  - code
capabilities:
  - code
`);

		writeFileSync(join(harnessDir, "gates", "all-acs-passing.yaml"), `
id: all-acs-passing
name: All ACs Passing
type: automated
blocking: true
description: All ACs must pass
`);

		writeFileSync(join(harnessDir, "flows", "flow-main.yaml"), `
id: flow-main
version: "0.2.0"
name: Main
description: Test
defaultPolicy: sdlc-default
stages:
  - id: code
    name: Code
    order: 0
    description: Code
    agents:
      - builder
    gate: all-acs-passing
`);

		const manifest = loadHarness(harnessDir);
		expect(manifest).not.toBeNull();
		expect(manifest!.roles.builder.handoff).toBeUndefined();
		expect(manifest!.gates["all-acs-passing"].blocksHandoff).toBe(false);
	});
});
