import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { Orchestrator } from "./orchestrator.js";
import { loadWorkflow } from "../commands/flow-init.js";

const roots: string[] = [];

function tempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-orchestrator-"));
	roots.push(root);
	mkdirSync(join(root, ".letra"), { recursive: true });
	return root;
}

function writeHarnessFile(root: string, path: string, content: string) {
	const fullPath = join(root, ".letra", "harness", path);
	const dir = fullPath.substring(0, fullPath.lastIndexOf("\\") !== -1 ? fullPath.lastIndexOf("\\") : fullPath.lastIndexOf("/"));
	mkdirSync(dir, { recursive: true });
	writeFileSync(fullPath, content);
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createWorkflow(root: string) {
	const workflow = {
		version: "1.0",
		name: "Test",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		harnessVersion: "v0.2.0",
		template: "main",
		stages: [
			{ id: "design", name: "Design", order: 0 },
			{ id: "code", name: "Code", order: 1 },
			{ id: "review", name: "Review", order: 2 },
			{ id: "done", name: "Done", order: 3, zone: "done" },
		],
		items: [
			{
				id: "ITEM-1",
				description: "Test item",
				stage: "code",
				spec: "test-spec",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
		tools: [],
	};
	writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow, null, 2));
	return workflow;
}

describe("Orchestrator", () => {
	describe("registerExecutor", () => {
		it("registers an executor", () => {
			const root = tempRoot();
			const orchestrator = new Orchestrator({ root });

			orchestrator.registerExecutor({
				id: "opencode",
				label: "OpenCode",
				capabilities: ["code", "review"],
				notification: ["sse", "polling"],
				heartbeat: true,
				maxExecutionTime: 1800,
				priority: 1,
			});

			const status = orchestrator.getExecutorStatus("opencode");
			expect(status).toBeDefined();
			expect(status!.executorId).toBe("opencode");
			expect(status!.isOnline).toBe(true);
		});
	});

	describe("detectPendingHandoff", () => {
		it("detects pending handoff for agent", () => {
			const root = tempRoot();
			createWorkflow(root);

			const workflow = loadWorkflow(root);
			const item = workflow.items.find((i) => i.id === "ITEM-1");
			item!.handoff = {
				from: "opencode",
				to: "reviewer",
				summary: "Implementation complete",
				evidence: ["src/test.ts"],
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			};
			writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow, null, 2));

			const orchestrator = new Orchestrator({ root });
			const pending = orchestrator.detectPendingHandoff("reviewer");
			expect(pending).not.toBeNull();
			expect(pending!.item.id).toBe("ITEM-1");
			expect(pending!.handoff.to).toBe("reviewer");
		});

		it("returns null for expired handoff", () => {
			const root = tempRoot();
			createWorkflow(root);

			const workflow = loadWorkflow(root);
			const item = workflow.items.find((i) => i.id === "ITEM-1");
			item!.handoff = {
				from: "opencode",
				to: "reviewer",
				summary: "Implementation complete",
				evidence: [],
				timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
				expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
			};
			writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow, null, 2));

			const orchestrator = new Orchestrator({ root });
			const pending = orchestrator.detectPendingHandoff("reviewer");
			expect(pending).toBeNull();
		});
	});

	describe("autoClaim", () => {
		it("claims item with CAS", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			const result = orchestrator.autoClaim("ITEM-1", "opencode", "implementer");
			expect(result.success).toBe(true);

			const workflow = loadWorkflow(root);
			const item = workflow.items.find((i) => i.id === "ITEM-1");
			expect(item!.claimedBy).toBe("opencode");
		});

		it("rejects claim when already claimed", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			orchestrator.autoClaim("ITEM-1", "opencode", "implementer");

			const result = orchestrator.autoClaim("ITEM-1", "cursor", "implementer");
			expect(result.success).toBe(false);
			expect(result.reason).toContain("already claimed");
		});

		it("allows claim when handoff matches agent", () => {
			const root = tempRoot();
			createWorkflow(root);

			const workflow = loadWorkflow(root);
			const item = workflow.items.find((i) => i.id === "ITEM-1");
			item!.handoff = {
				from: "opencode",
				to: "reviewer",
				summary: "Implementation complete",
				evidence: [],
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			};
			writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow, null, 2));

			const orchestrator = new Orchestrator({ root });
			const result = orchestrator.autoClaim("ITEM-1", "cursor", "reviewer");
			expect(result.success).toBe(true);
		});
	});

	describe("reclaimStaleItems", () => {
		it("reclaims stale items", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			orchestrator.autoClaim("ITEM-1", "opencode", "implementer");

			const lock = (orchestrator as any).claimLocks.get("ITEM-1");
			lock.claimedAt = Date.now() - 2 * 60 * 60 * 1000;

			const reclaimed = orchestrator.reclaimStaleItems();
			expect(reclaimed).toContain("ITEM-1");

			const workflow = loadWorkflow(root);
			const item = workflow.items.find((i) => i.id === "ITEM-1");
			expect(item!.claimedBy).toBeUndefined();
		});
	});

	describe("heartbeat", () => {
		it("updates heartbeat timestamp", () => {
			const root = tempRoot();
			const orchestrator = new Orchestrator({ root });

			orchestrator.registerExecutor({
				id: "opencode",
				label: "OpenCode",
				capabilities: ["code"],
				notification: ["sse"],
				heartbeat: true,
				maxExecutionTime: 1800,
				priority: 1,
			});

			const before = orchestrator.getExecutorStatus("opencode");
			orchestrator.heartbeat("opencode");
			const after = orchestrator.getExecutorStatus("opencode");

			expect(after!.isOnline).toBe(true);
			expect(after!.executorId).toBe("opencode");
		});
	});

	describe("getAllExecutorStatuses", () => {
		it("returns all executor statuses", () => {
			const root = tempRoot();
			const orchestrator = new Orchestrator({ root });

			orchestrator.registerExecutor({
				id: "opencode",
				label: "OpenCode",
				capabilities: ["code"],
				notification: ["sse"],
				heartbeat: true,
				maxExecutionTime: 1800,
				priority: 1,
			});

			orchestrator.registerExecutor({
				id: "cursor",
				label: "Cursor",
				capabilities: ["code"],
				notification: ["file-watch"],
				heartbeat: false,
				maxExecutionTime: 3600,
				priority: 2,
			});

			const statuses = orchestrator.getAllExecutorStatuses();
			expect(statuses).toHaveLength(2);
		});
	});

	describe("buildContext", () => {
		it("includes promptTemplate from manifest role", () => {
			const root = tempRoot();
			writeHarnessFile(root, "v0.2.0/gates/code-reviewed.yaml", "id: code-reviewed\ntype: automated\nblocking: true\nstatus: approved\n");
			writeHarnessFile(root, "v0.2.0/roles/implementer.yaml", "id: implementer\nlabel: Implementer\nallowedStages:\n  - code\ncapabilities:\n  - code\nprompt-template: roles/prompts/implementer.md\n");
			writeHarnessFile(root, "v0.2.0/flows/flow-main.yaml", "id: flow-main\nversion: 0.2.0\nname: Main\nstages:\n  - id: code\n    name: Code\n    order: 1\n    agents:\n      - implementer\n    gate: code-reviewed\n");
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			const context = orchestrator.buildContext("ITEM-1", "implementer");

			expect(context).not.toBeNull();
			expect(context!.promptTemplate).toBe("roles/prompts/implementer.md");
		});

		it("returns null promptTemplate when no role has template", () => {
			const root = tempRoot();
			writeHarnessFile(root, "v0.2.0/gates/code-reviewed.yaml", "id: code-reviewed\ntype: automated\nblocking: true\nstatus: approved\n");
			writeHarnessFile(root, "v0.2.0/roles/implementer.yaml", "id: implementer\nlabel: Implementer\nallowedStages:\n  - code\ncapabilities:\n  - code\n");
			writeHarnessFile(root, "v0.2.0/flows/flow-main.yaml", "id: flow-main\nversion: 0.2.0\nname: Main\nstages:\n  - id: code\n    name: Code\n    order: 1\n    agents:\n      - implementer\n    gate: code-reviewed\n");
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			const context = orchestrator.buildContext("ITEM-1", "implementer");

			expect(context).not.toBeNull();
			expect(context!.promptTemplate).toBeNull();
		});
	});

	describe("autoClaim with maxExecutionTime from executor config", () => {
		it("uses executor maxExecutionTime for lock expiry", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			orchestrator.registerExecutor({
				id: "opencode",
				label: "OpenCode",
				capabilities: ["code"],
				notification: ["sse"],
				heartbeat: true,
				maxExecutionTime: 60,
				priority: 1,
			});

			const first = orchestrator.autoClaim("ITEM-1", "opencode", "implementer");
			expect(first.success).toBe(true);

			const lock = (orchestrator as any).claimLocks.get("ITEM-1");
			lock.claimedAt = Date.now() - 61 * 1000;

			const result = orchestrator.autoClaim("ITEM-1", "cursor", "implementer");
			expect(result.success).toBe(true);
		});

		it("rejects claim when within executor maxExecutionTime", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			orchestrator.registerExecutor({
				id: "opencode",
				label: "OpenCode",
				capabilities: ["code"],
				notification: ["sse"],
				heartbeat: true,
				maxExecutionTime: 120,
				priority: 1,
			});

			orchestrator.autoClaim("ITEM-1", "opencode", "implementer");

			const lock = (orchestrator as any).claimLocks.get("ITEM-1");
			lock.claimedAt = Date.now() - 30 * 1000;

			const result = orchestrator.autoClaim("ITEM-1", "cursor", "implementer");
			expect(result.success).toBe(false);
			expect(result.reason).toContain("already claimed");
		});
	});

	describe("emitHandoff writes file watch", () => {
		it("creates handoff file on emit", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			const now = new Date();
			const result = orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Done",
				evidence: ["src/test.ts"],
				timestamp: now.toISOString(),
				expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
			});

			expect(result.success).toBe(true);
			const handoffFile = join(root, ".letra", "handoffs", "ITEM-1.json");
			expect(existsSync(handoffFile)).toBe(true);
			const data = JSON.parse(readFileSync(handoffFile, "utf-8"));
			expect(data.to).toBe("reviewer");
			expect(data.from).toBe("opencode");
		});

		it("removes handoff file on autoClaim", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			const now = new Date();
			orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Done",
				evidence: [],
				timestamp: now.toISOString(),
				expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
			});

			const handoffFile = join(root, ".letra", "handoffs", "ITEM-1.json");
			expect(existsSync(handoffFile)).toBe(true);

			orchestrator.autoClaim("ITEM-1", "cursor", "reviewer");
			expect(existsSync(handoffFile)).toBe(false);
		});
	});

	describe("retryHandoff", () => {
		it("re-emits expired handoff to next executor", () => {
			const root = tempRoot();
			createWorkflow(root);
			writeHarnessFile(root, "v0.2.0/gates/code-reviewed.yaml", "id: code-reviewed\ntype: automated\nblocking: true\nstatus: approved\n");
			writeHarnessFile(root, "v0.2.0/roles/implementer.yaml", "id: implementer\nlabel: Implementer\nallowedStages:\n  - code\ncapabilities:\n  - code\n");
			writeHarnessFile(root, "v0.2.0/flows/flow-main.yaml", "id: flow-main\nversion: 0.2.0\nname: Main\nstages:\n  - id: code\n    name: Code\n    order: 1\n    agents:\n      - implementer\n    gate: code-reviewed\n");
			writeHarnessFile(root, "v0.2.0/executors/registry.yaml",
				"executors:\n  - id: opencode\n    label: OpenCode\n    capabilities: [code]\n    notification: [sse]\n    heartbeat: true\n    maxExecutionTime: 1800\n    priority: 1\n  - id: cursor\n    label: Cursor\n    capabilities: [code]\n    notification: [file-watch]\n    heartbeat: false\n    maxExecutionTime: 1800\n    priority: 2\n",
			);

			const orchestrator = new Orchestrator({ root });
			const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
			orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Done",
				evidence: [],
				timestamp: past.toISOString(),
				expiresAt: past.toISOString(),
				executorId: "opencode",
			});

			const result = orchestrator.retryHandoff("ITEM-1");
			expect(result.success).toBe(true);
			expect(result.reEmittedTo).toBeDefined();

			const workflow = loadWorkflow(root);
			const item = workflow!.items.find((i) => i.id === "ITEM-1");
			expect(item!.handoff).toBeDefined();
			expect(item!.handoff!.executorId).not.toBe("opencode");
		});

		it("fails when handoff has not expired", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			const future = new Date(Date.now() + 30 * 60 * 1000);
			orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Done",
				evidence: [],
				timestamp: new Date().toISOString(),
				expiresAt: future.toISOString(),
			});

			const result = orchestrator.retryHandoff("ITEM-1");
			expect(result.success).toBe(false);
			expect(result.reason).toContain("not expired");
		});

		it("fails when no other executor available", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
			orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Done",
				evidence: [],
				timestamp: past.toISOString(),
				expiresAt: past.toISOString(),
				executorId: "opencode",
			});

			const result = orchestrator.retryHandoff("ITEM-1");
			expect(result.success).toBe(false);
			expect(result.reason).toContain("No executor registry");
		});
	});

	describe("getPendingHandoffFiles", () => {
		it("returns pending handoffs from files", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			const future = new Date(Date.now() + 30 * 60 * 1000);
			orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Done",
				evidence: [],
				timestamp: new Date().toISOString(),
				expiresAt: future.toISOString(),
			});

			const pending = orchestrator.getPendingHandoffFiles();
			expect(pending).toHaveLength(1);
			expect(pending[0].itemId).toBe("ITEM-1");
			expect(pending[0].to).toBe("reviewer");
		});

		it("excludes expired handoff files", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			const past = new Date(Date.now() - 60 * 60 * 1000);
			orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Done",
				evidence: [],
				timestamp: past.toISOString(),
				expiresAt: past.toISOString(),
			});

			const pending = orchestrator.getPendingHandoffFiles();
			expect(pending).toHaveLength(0);
		});
	});
});
