import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FlowServer } from "../commands/flow-serve.js";
import { createSimulatedExecutor } from "../orchestrator/simulated-executor.js";
import { loadWorkflow, saveWorkflow } from "../commands/flow-init.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

function tempRoot(): string {
	return mkdtempSync(join(tmpdir(), "letra-flow-serve-test-"));
}

function createWorkflow(root: string): void {
	execFileSync("git", ["init", root], { stdio: "ignore" });
	const harnessDir = join(root, ".letra", "harness", "v0.2.0");
	mkdirSync(join(harnessDir, "flows"), { recursive: true });
	mkdirSync(join(harnessDir, "roles"), { recursive: true });
	mkdirSync(join(harnessDir, "gates"), { recursive: true });
	mkdirSync(join(harnessDir, "executors"), { recursive: true });
	writeFileSync(
		join(harnessDir, "flows", "flow-main.yaml"),
		"id: flow-main\nversion: 1\nname: Flow\ndescription: test\ndefaultPolicy: default\nstages:\n  - id: code\n    name: Code\n    order: 1\n    zone: doing\n    agents:\n      - implementer\n    gate: null\n  - id: review\n    name: Review\n    order: 2\n    zone: doing\n    agents:\n      - reviewer\n    gate: null\n  - id: security\n    name: Security\n    order: 3\n    zone: doing\n    agents:\n      - security\n    gate: human-approved\n",
	);
	writeFileSync(join(harnessDir, "gates", "human-approved.yaml"), "id: human-approved\nname: Human approval\ntype: human\nblocking: true\nblocksHandoff: true\ndescription: test\n");
	for (const [id, stage, capability] of [["implementer", "code", "write_code"], ["reviewer", "review", "review_code"], ["security", "security", "security_scan"]]) {
		writeFileSync(join(harnessDir, "roles", `${id}.yaml`), `id: ${id}\nlabel: ${id}\ndescription: test\nallowedStages:\n  - ${stage}\ncapabilities:\n  - ${capability}\n`);
	}
	writeFileSync(join(harnessDir, "executors", "registry.yaml"), "executors:\n  - id: codex\n    label: Codex\n    capabilities:\n      - write_code\n      - review_code\n      - security_scan\n    notification:\n      - polling\n    heartbeat: true\n    maxExecutionTime: 1800\n    priority: 1\nstageExecutorPreferences:\n  code:\n    - codex\n  review:\n    - codex\n  security:\n    - codex\n");

	const letraDir = join(root, ".letra");
	mkdirSync(letraDir, { recursive: true });
	mkdirSync(join(letraDir, "specs", "auth"), { recursive: true });
	writeFileSync(join(letraDir, "specs", "auth", "spec.md"), "# Auth\n\n## Outcome\n\nTest flow.\n\n## Acceptance Criteria\n\n- [x] **AC1**: ready\n");
	writeFileSync(
		join(letraDir, "workflow.json"),
		JSON.stringify({
			id: "wf-test",
			name: "Test Workflow",
			template: "flow-main",
			harnessVersion: "v0.2.0",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			stages: [
				{ id: "code", name: "Code", order: 1 },
				{ id: "review", name: "Review", order: 2 },
			],
			items: [
				{
					id: "ITEM-1",
					title: "Test Item",
					stage: "code",
					spec: "auth",
					createdAt: new Date().toISOString(),
				},
			],
			primaryItemId: "ITEM-1",
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
	writeFileSync(join(letraDir, "agents.json"), JSON.stringify({ version: "1", updatedAt: new Date().toISOString(), agents: ["implementer", "reviewer", "security"].map((role) => ({ id: role, displayName: role, role, avatar: { type: "initials", value: role.slice(0, 2) }, color: "blue", skills: [], status: "online", stageBindings: [{ implementer: "code", reviewer: "review", security: "security" }[role]] })) }, null, 2));
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
		const server = new FlowServer(root, 3003, { autopilot: true, dispatcherIntervalMs: 60_000, executorFactory: (_root, capabilities) => [createSimulatedExecutor("codex", [...capabilities, "write_code", "review_code", "security_scan"])] });
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
		const server = new FlowServer(root, 3004, { autopilot: true, dispatcherIntervalMs: 60_000, executorFactory: (_root, capabilities) => [createSimulatedExecutor("codex", [...capabilities, "write_code", "review_code", "security_scan"])] });
		await server.start();
		await new Promise((resolve) => setTimeout(resolve, 250));
		const dispatchResult = await (server as any).dispatcher.dispatch();
		expect(dispatchResult[0]?.reason).toBeUndefined();
		server.stop();
		const updated = loadWorkflow(root)!;
		expect(updated.items[0].activityStatus).toBe("succeeded");
		expect(updated.items[0].handoff?.to).toBe("human");
		expect(updated.items[0].handoff?.evidence).toContain("simulated:review:ITEM-1");
		const logFiles = readdirSync(join(root, ".letra", "session-log"), { recursive: true }) as string[];
		const logContent = logFiles.filter((file) => file.endsWith(".jsonl")).map((file) => readFileSync(join(root, ".letra", "session-log", file), "utf8")).join("\n");
		expect(logContent).toContain("Autonomous dispatcher: dispatched");
	});
});
