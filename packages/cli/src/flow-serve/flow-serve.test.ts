import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FlowServer } from "../commands/flow-serve.js";
import { loadWorkflow, saveWorkflow } from "../commands/flow-init.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
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

	it("wires the semiautonomous dispatcher only when autopilot is enabled", async () => {
		const server = new FlowServer(root, 3003, { autopilot: true, dispatcherIntervalMs: 60_000 });
		const dispatcher = (server as any).dispatcher;
		expect(dispatcher).toBeDefined();
		const startSpy = vi.spyOn(dispatcher, "start");
		await server.start();
		expect(startSpy).toHaveBeenCalledTimes(1);
		server.stop();
	});

	it("runs a handoff to the human gate and leaves an auditable pause", async () => {
		const workflow = loadWorkflow(root)!;
		workflow.items[0].handoff = {
			from: "design",
			to: "implementer",
			summary: "Implement approved work",
			evidence: ["spec-approved"],
			timestamp: new Date().toISOString(),
			expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
		};
		saveWorkflow(root, workflow);
		const server = new FlowServer(root, 3004, { autopilot: true, dispatcherIntervalMs: 60_000 });
		await server.start();
		await new Promise((resolve) => setTimeout(resolve, 80));
		server.stop();
		const updated = loadWorkflow(root)!;
		expect(updated.items[0].activityStatus).toBe("succeeded");
		expect(updated.items[0].handoff?.to).toBe("human");
		expect(updated.items[0].handoff?.evidence).toContain("simulated:implement:ITEM-1");
		const logFiles = readdirSync(join(root, ".letra", "session-log"), { recursive: true }) as string[];
		const logContent = logFiles.filter((file) => file.endsWith(".jsonl")).map((file) => readFileSync(join(root, ".letra", "session-log", file), "utf8")).join("\n");
		expect(logContent).toContain("Autonomous dispatcher: dispatched");
	});
});
