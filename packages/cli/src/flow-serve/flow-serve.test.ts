import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FlowServer } from "../commands/flow-serve.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function tempRoot(): string {
	return mkdtempSync(join(tmpdir(), "letra-flow-serve-test-"));
}

function createWorkflow(root: string): void {
	const harnessDir = join(root, ".letra", "harness");
	mkdirSync(harnessDir, { recursive: true });
	writeFileSync(
		join(harnessDir, "manifest.yaml"),
		`version: "0.2.0"
executors:
  executors:
    - id: opencode
      label: OpenCode
      capabilities: [code, review]
      notification:
        type: file-watch
      heartbeat:
        intervalMs: 30000
        timeoutMs: 60000
      priority: 1
      maxExecutionTime: 1800
  stageExecutorPreferences:
    implement: [opencode]
`,
	);

	const letraDir = join(root, ".letra");
	mkdirSync(letraDir, { recursive: true });
	writeFileSync(
		join(letraDir, "workflow.json"),
		JSON.stringify({
			id: "wf-test",
			name: "Test Workflow",
			templateId: "flow-main",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			stages: [
				{ id: "implement", name: "Implement", order: 1 },
				{ id: "review", name: "Review", order: 2 },
			],
			items: [
				{
					id: "ITEM-1",
					title: "Test Item",
					stage: "implement",
					createdAt: new Date().toISOString(),
				},
			],
			locations: [
				{
					id: "loc-1",
					type: "project",
					path: root,
					adapters: ["opencode"],
				},
			],
		}),
	);
}

describe("FlowServer SSE + Orchestrator Integration", () => {
	let root: string;

	beforeEach(() => {
		root = tempRoot();
		createWorkflow(root);
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("FlowServer creates orchestrator with onHandoffEvent wired to SSE", () => {
		const server = new FlowServer(root, 3001);

		// Access private orchestrator via reflection
		const orchestrator = (server as any).orchestrator;
		expect(orchestrator).toBeDefined();
		expect(typeof orchestrator.registerFromManifest).toBe("function");
		expect(typeof orchestrator.startReclaimTimer).toBe("function");
	});

	it("FlowServer broadcasts handoff events via SSE when orchestrator emits", async () => {
		const server = new FlowServer(root, 3002);

		// Get the events object
		const events = (server as any).events;
		const broadcastHandoffSpy = vi.spyOn(events, "broadcastHandoff");

		// Get the orchestrator and emit a handoff
		const orchestrator = (server as any).orchestrator;
		orchestrator.emitHandoff({
			itemId: "ITEM-1",
			from: "opencode",
			to: "reviewer",
			summary: "Review code",
			evidence: [],
			timestamp: new Date().toISOString(),
			expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
		});

		// Verify SSE broadcast was called
		expect(broadcastHandoffSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				action: "emitted",
			}),
		);
	});
});
