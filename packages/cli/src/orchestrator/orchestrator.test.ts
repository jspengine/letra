import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
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

			const lockPath = join(root, ".letra", "locks", "ITEM-1.lock");
			const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
			lock.claimedAt = Date.now() - 2 * 60 * 60 * 1000;
			writeFileSync(lockPath, JSON.stringify(lock, null, 2));

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

			const lockPath = join(root, ".letra", "locks", "ITEM-1.lock");
			const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
			lock.claimedAt = Date.now() - 61 * 1000;
			writeFileSync(lockPath, JSON.stringify(lock, null, 2));

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

			const lockPath = join(root, ".letra", "locks", "ITEM-1.lock");
			const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
			lock.claimedAt = Date.now() - 30 * 1000;
			writeFileSync(lockPath, JSON.stringify(lock, null, 2));

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

	describe("file lock persistence", () => {
		it("writes lock file to disk on claim", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			orchestrator.autoClaim("ITEM-1", "opencode", "implementer");

			const lockPath = join(root, ".letra", "locks", "ITEM-1.lock");
			expect(existsSync(lockPath)).toBe(true);

			const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
			expect(lock.executor).toBe("opencode");
			expect(lock.claimedAt).toBeDefined();
		});

		it("reads lock from another orchestrator instance", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator1 = new Orchestrator({ root });
			orchestrator1.autoClaim("ITEM-1", "opencode", "implementer");

			const orchestrator2 = new Orchestrator({ root });
			const result = orchestrator2.autoClaim("ITEM-1", "cursor", "implementer");
			expect(result.success).toBe(false);
			expect(result.reason).toContain("already claimed");
		});

		it("deletes lock file on reclaim", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orchestrator = new Orchestrator({ root });
			orchestrator.autoClaim("ITEM-1", "opencode", "implementer");

			const lockPath = join(root, ".letra", "locks", "ITEM-1.lock");
			const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
			lock.claimedAt = Date.now() - 2 * 60 * 60 * 1000;
			writeFileSync(lockPath, JSON.stringify(lock, null, 2));

			orchestrator.reclaimStaleItems();
			expect(existsSync(lockPath)).toBe(false);
		});
	});

	describe("onHandoffEvent callback", () => {
		it("calls onHandoffEvent on emitHandoff", () => {
			const root = tempRoot();
			createWorkflow(root);

			const onHandoffEvent = vi.fn();
			const orchestrator = new Orchestrator({ root, onHandoffEvent });

			orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Review code",
				evidence: [],
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
			});

			expect(onHandoffEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					itemId: "ITEM-1",
					action: "emitted",
				}),
			);
		});

		it("calls onHandoffEvent on autoClaim with handoff", () => {
			const root = tempRoot();
			createWorkflow(root);

			const onHandoffEvent = vi.fn();
			const orchestrator = new Orchestrator({ root, onHandoffEvent });

			orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Review code",
				evidence: [],
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
			});

			orchestrator.autoClaim("ITEM-1", "cursor", "reviewer");

			expect(onHandoffEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					itemId: "ITEM-1",
					action: "claimed",
				}),
			);
		});

		it("calls onHandoffEvent on retryHandoff", () => {
			const root = tempRoot();
			createWorkflow(root);
			writeHarnessFile(root, "v0.2.0/gates/code-reviewed.yaml", "id: code-reviewed\ntype: automated\nblocking: true\nstatus: approved\n");
			writeHarnessFile(root, "v0.2.0/roles/implementer.yaml", "id: implementer\nlabel: Implementer\nallowedStages:\n  - code\ncapabilities:\n  - code\n");
			writeHarnessFile(root, "v0.2.0/flows/flow-main.yaml", "id: flow-main\nversion: 0.2.0\nname: Main\nstages:\n  - id: code\n    name: Code\n    order: 1\n    agents:\n      - implementer\n    gate: code-reviewed\n");
			writeHarnessFile(root, "v0.2.0/executors/registry.yaml",
				"executors:\n  - id: opencode\n    label: OpenCode\n    capabilities: [code]\n    notification: [sse]\n    heartbeat: true\n    maxExecutionTime: 1800\n    priority: 1\n  - id: cursor\n    label: Cursor\n    capabilities: [code]\n    notification: [file-watch]\n    heartbeat: false\n    maxExecutionTime: 1800\n    priority: 2\n",
			);

			const onHandoffEvent = vi.fn();
			const orchestrator = new Orchestrator({ root, onHandoffEvent });

			const past = new Date(Date.now() - 60 * 60 * 1000);
			orchestrator.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Review code",
				evidence: [],
				timestamp: past.toISOString(),
				expiresAt: past.toISOString(),
			});

			orchestrator.retryHandoff("ITEM-1");

			expect(onHandoffEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					itemId: "ITEM-1",
					action: "retry",
				}),
			);
		});
	});

	describe("cross-process concurrency", () => {
		it("second orchestrator cannot claim item locked by first", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orch1 = new Orchestrator({ root });
			const orch2 = new Orchestrator({ root });

			const result1 = orch1.autoClaim("ITEM-1", "opencode", "implementer");
			expect(result1.success).toBe(true);

			const result2 = orch2.autoClaim("ITEM-1", "cursor", "implementer");
			expect(result2.success).toBe(false);
			expect(result2.reason).toContain("already claimed");
		});

		it("second orchestrator can claim after lock expires", () => {
			const root = tempRoot();
			createWorkflow(root);

			const orch1 = new Orchestrator({ root });
			orch1.registerExecutor({
				id: "opencode",
				label: "OpenCode",
				capabilities: ["code"],
				notification: ["sse"],
				heartbeat: true,
				maxExecutionTime: 60,
				priority: 1,
			});

			orch1.autoClaim("ITEM-1", "opencode", "implementer");

			const lockPath = join(root, ".letra", "locks", "ITEM-1.lock");
			const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
			lock.claimedAt = Date.now() - 61 * 1000;
			writeFileSync(lockPath, JSON.stringify(lock, null, 2));

			const orch2 = new Orchestrator({ root });
			orch2.registerExecutor({
				id: "opencode",
				label: "OpenCode",
				capabilities: ["code"],
				notification: ["sse"],
				heartbeat: true,
				maxExecutionTime: 60,
				priority: 1,
			});

			const result = orch2.autoClaim("ITEM-1", "cursor", "implementer");
			expect(result.success).toBe(true);
		});

		it("concurrent claim attempts result in exactly one winner", () => {
			const root = tempRoot();
			createWorkflow(root);

			const results: boolean[] = [];
			const orchestrators = Array.from({ length: 5 }, () => new Orchestrator({ root }));

			for (const orch of orchestrators) {
				const result = orch.autoClaim("ITEM-1", `executor-${Math.random()}`, "implementer");
				results.push(result.success);
			}

			const winners = results.filter(Boolean);
			expect(winners).toHaveLength(1);
		});
	});

	describe("full flow regression", () => {
		it("design -> code -> review -> security -> done", () => {
			const root = tempRoot();

			writeHarnessFile(root, "v0.2.0/gates/spec-approved.yaml", [
				"id: spec-approved",
				"name: Spec Aprovado",
				"type: human",
				"blocking: true",
				"description: Aprovação de spec",
			].join("\n"));
			writeHarnessFile(root, "v0.2.0/gates/code-reviewed.yaml", [
				"id: code-reviewed",
				"name: Code Revisado",
				"type: automated",
				"blocking: true",
				"status: approved",
			].join("\n"));
			writeHarnessFile(root, "v0.2.0/gates/security-clear.yaml", [
				"id: security-clear",
				"name: Security Clear",
				"type: automated",
				"blocking: true",
				"status: approved",
			].join("\n"));
			writeHarnessFile(root, "v0.2.0/gates/human-approved.yaml", [
				"id: human-approved",
				"name: Aprovação Humana",
				"type: human",
				"blocking: true",
			].join("\n"));

			writeHarnessFile(root, "v0.2.0/roles/analyst.yaml", [
				"id: analyst",
				"label: Analyst",
				"allowedStages: [design]",
				"capabilities: [design]",
			].join("\n"));
			writeHarnessFile(root, "v0.2.0/roles/implementer.yaml", [
				"id: implementer",
				"label: Implementer",
				"allowedStages: [code]",
				"capabilities: [code]",
			].join("\n"));
			writeHarnessFile(root, "v0.2.0/roles/reviewer.yaml", [
				"id: reviewer",
				"label: Reviewer",
				"allowedStages: [review]",
				"capabilities: [review]",
			].join("\n"));
			writeHarnessFile(root, "v0.2.0/roles/security.yaml", [
				"id: security",
				"label: Security",
				"allowedStages: [security]",
				"capabilities: [security]",
			].join("\n"));

			writeHarnessFile(root, "v0.2.0/flows/flow-main.yaml", [
				"id: flow-main",
				"version: 0.2.0",
				"name: Main Flow",
				"description: Full SDLC flow",
				"defaultPolicy: policies/default.json",
				"stages:",
				"  - id: design",
				"    name: Design",
				"    order: 0",
				"    zone: doing",
				"    description: Design phase",
				"    agents: [analyst]",
				"    gate: spec-approved",
				"  - id: code",
				"    name: Code",
				"    order: 1",
				"    zone: doing",
				"    description: Implementation phase",
				"    agents: [implementer]",
				"    gate: code-reviewed",
				"  - id: review",
				"    name: Review",
				"    order: 2",
				"    zone: doing",
				"    description: Review phase",
				"    agents: [reviewer]",
				"    gate: security-clear",
				"  - id: security",
				"    name: Security",
				"    order: 3",
				"    zone: doing",
				"    description: Security review",
				"    agents: [security]",
				"    gate: human-approved",
				"  - id: done",
				"    name: Done",
				"    order: 4",
				"    zone: done",
				"    description: Completed",
				"    agents: []",
				"    gate: null",
			].join("\n"));

			const workflow = {
				version: "1.0",
				name: "Regression Test",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
				harnessVersion: "v0.2.0",
				template: "flow-main",
				stages: [
					{ id: "design", name: "Design", order: 0, zone: "doing", gate: "spec-approved" },
					{ id: "code", name: "Code", order: 1, zone: "doing", gate: "code-reviewed" },
					{ id: "review", name: "Review", order: 2, zone: "doing", gate: "security-clear" },
					{ id: "security", name: "Security", order: 3, zone: "doing", gate: "human-approved" },
					{ id: "done", name: "Done", order: 4, zone: "done" },
				],
				items: [
					{
						id: "ITEM-REG",
						description: "Regression test item",
						stage: "design",
						createdAt: "2026-01-01T00:00:00.000Z",
					},
				],
				tools: [],
			};
			writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(workflow, null, 2));

			const orch = new Orchestrator({ root });
			orch.registerExecutor({ id: "analyst", label: "Analyst", capabilities: ["design"], notification: ["sse"], heartbeat: false, maxExecutionTime: 1800, priority: 1 });
			orch.registerExecutor({ id: "implementer", label: "Implementer", capabilities: ["code"], notification: ["sse"], heartbeat: false, maxExecutionTime: 1800, priority: 1 });
			orch.registerExecutor({ id: "reviewer", label: "Reviewer", capabilities: ["review"], notification: ["sse"], heartbeat: false, maxExecutionTime: 1800, priority: 1 });
			orch.registerExecutor({ id: "security", label: "Security", capabilities: ["security"], notification: ["sse"], heartbeat: false, maxExecutionTime: 1800, priority: 1 });

			// design -> code
			orch.emitHandoff({
				itemId: "ITEM-REG",
				from: "analyst",
				to: "implementer",
				summary: "Design complete",
				evidence: ["design.md"],
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			});
			let wf = loadWorkflow(root);
			expect(wf.items[0].handoff!.to).toBe("implementer");
			orch.autoClaim("ITEM-REG", "implementer", "implementer");
			wf = loadWorkflow(root);
			expect(wf.items[0].stage).toBe("design");
			expect(wf.items[0].claimedBy).toBe("implementer");

			// move to code
			wf.items[0].stage = "code";
			wf.items[0].claimedBy = undefined;
			wf.items[0].claimedAt = undefined;
			writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(wf, null, 2));

			// code -> review
			orch.emitHandoff({
				itemId: "ITEM-REG",
				from: "implementer",
				to: "reviewer",
				summary: "Implementation complete",
				evidence: ["src/index.ts"],
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			});
			orch.autoClaim("ITEM-REG", "reviewer", "reviewer");
			wf = loadWorkflow(root);
			expect(wf.items[0].stage).toBe("code");

			// move to review
			wf.items[0].stage = "review";
			wf.items[0].claimedBy = undefined;
			wf.items[0].claimedAt = undefined;
			writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(wf, null, 2));

			// review -> security
			orch.emitHandoff({
				itemId: "ITEM-REG",
				from: "reviewer",
				to: "security",
				summary: "Review approved",
				evidence: ["review-report.md"],
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			});
			orch.autoClaim("ITEM-REG", "security", "security");
			wf = loadWorkflow(root);
			expect(wf.items[0].stage).toBe("review");

			// move to security
			wf.items[0].stage = "security";
			wf.items[0].claimedBy = undefined;
			wf.items[0].claimedAt = undefined;
			writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(wf, null, 2));

			// security -> done
			orch.emitHandoff({
				itemId: "ITEM-REG",
				from: "security",
				to: "done",
				summary: "Security approved",
				evidence: ["security-report.md"],
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			});

			wf = loadWorkflow(root);
			wf.items[0].stage = "done";
			wf.items[0].claimedBy = undefined;
			delete wf.items[0].handoff;
			writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify(wf, null, 2));

			wf = loadWorkflow(root);
			expect(wf.items[0].stage).toBe("done");
			expect(wf.items[0].handoff).toBeUndefined();
			expect(wf.items[0].claimedBy).toBeUndefined();
		});
	});

	describe("cross-adapter handoff", () => {
		it("handoff from opencode to cursor with context transfer", () => {
			const root = tempRoot();
			createWorkflow(root);

			writeHarnessFile(root, "v0.2.0/gates/code-reviewed.yaml", "id: code-reviewed\ntype: automated\nblocking: true\nstatus: approved\n");
			writeHarnessFile(root, "v0.2.0/roles/implementer.yaml", "id: implementer\nlabel: Implementer\nallowedStages:\n  - code\ncapabilities:\n  - code\n");
			writeHarnessFile(root, "v0.2.0/roles/reviewer.yaml", "id: reviewer\nlabel: Reviewer\nallowedStages:\n  - review\ncapabilities:\n  - review\n");
			writeHarnessFile(root, "v0.2.0/flows/flow-main.yaml", "id: flow-main\nversion: 0.2.0\nname: Main\nstages:\n  - id: code\n    name: Code\n    order: 1\n    agents:\n      - implementer\n    gate: code-reviewed\n  - id: review\n    name: Review\n    order: 2\n    agents:\n      - reviewer\n    gate: null\n");
			writeHarnessFile(root, "v0.2.0/executors/registry.yaml", [
				"executors:",
				"  - id: opencode",
				"    label: OpenCode",
				"    capabilities: [code]",
				"    notification: [sse]",
				"    heartbeat: true",
				"    maxExecutionTime: 1800",
				"    priority: 1",
				"  - id: cursor",
				"    label: Cursor",
				"    capabilities: [code, review]",
				"    notification: [file-watch]",
				"    heartbeat: false",
				"    maxExecutionTime: 1800",
				"    priority: 2",
			].join("\n"));

			const orch = new Orchestrator({ root });
			orch.registerFromManifest();

			// opencode claims and works on item
			orch.autoClaim("ITEM-1", "opencode", "implementer");
			let wf = loadWorkflow(root);
			expect(wf.items[0].claimedBy).toBe("opencode");

			// clear the lock so cursor can claim
			const lockPath = join(root, ".letra", "locks", "ITEM-1.lock");
			unlinkSync(lockPath);

			// opencode hands off to reviewer (cursor)
			const emitResult = orch.emitHandoff({
				itemId: "ITEM-1",
				from: "opencode",
				to: "reviewer",
				summary: "Implementation complete, needs review",
				evidence: ["src/auth.ts", "tests/auth.test.ts"],
				timestamp: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
				executorId: "opencode",
			});
			expect(emitResult.success).toBe(true);

			wf = loadWorkflow(root);
			expect(wf.items[0].handoff).toBeDefined();
			expect(wf.items[0].handoff!.from).toBe("opencode");
			expect(wf.items[0].handoff!.to).toBe("reviewer");
			expect(wf.items[0].handoff!.executorId).toBe("opencode");
			expect(wf.items[0].handoff!.evidence).toContain("src/auth.ts");

			// cursor detects and claims the handoff
			const pending = orch.detectPendingHandoff("reviewer");
			expect(pending).not.toBeNull();
			expect(pending!.item.id).toBe("ITEM-1");

			const claimResult = orch.autoClaim("ITEM-1", "cursor", "reviewer");
			expect(claimResult.success).toBe(true);

			wf = loadWorkflow(root);
			expect(wf.items[0].claimedBy).toBe("cursor");
			expect(wf.items[0].handoff).toBeUndefined();

			// verify context transfer
			const context = orch.buildContext("ITEM-1", "reviewer");
			expect(context).not.toBeNull();
			expect(context!.item.id).toBe("ITEM-1");
			expect(context!.agent).toBe("reviewer");
		});

		it("retry handoff falls back to next executor by priority", () => {
			const root = tempRoot();
			createWorkflow(root);

			writeHarnessFile(root, "v0.2.0/gates/code-reviewed.yaml", "id: code-reviewed\ntype: automated\nblocking: true\nstatus: approved\n");
			writeHarnessFile(root, "v0.2.0/roles/implementer.yaml", "id: implementer\nlabel: Implementer\nallowedStages:\n  - code\ncapabilities:\n  - code\n");
			writeHarnessFile(root, "v0.2.0/flows/flow-main.yaml", "id: flow-main\nversion: 0.2.0\nname: Main\nstages:\n  - id: code\n    name: Code\n    order: 1\n    agents:\n      - implementer\n    gate: code-reviewed\n");
			writeHarnessFile(root, "v0.2.0/executors/registry.yaml", [
				"executors:",
				"  - id: opencode",
				"    label: OpenCode",
				"    capabilities: [code]",
				"    notification: [sse]",
				"    heartbeat: true",
				"    maxExecutionTime: 1800",
				"    priority: 1",
				"  - id: cursor",
				"    label: Cursor",
				"    capabilities: [code]",
				"    notification: [file-watch]",
				"    heartbeat: false",
				"    maxExecutionTime: 1800",
				"    priority: 2",
				"  - id: claude",
				"    label: Claude Code",
				"    capabilities: [code]",
				"    notification: [sse]",
				"    heartbeat: true",
				"    maxExecutionTime: 1800",
				"    priority: 3",
			].join("\n"));

			const orch = new Orchestrator({ root });
			orch.registerFromManifest();

			// emit handoff with opencode as executor
			const past = new Date(Date.now() - 60 * 60 * 1000);
			orch.emitHandoff({
				itemId: "ITEM-1",
				from: "analyst",
				to: "implementer",
				summary: "Design complete",
				evidence: [],
				timestamp: past.toISOString(),
				expiresAt: past.toISOString(),
				executorId: "opencode",
			});

			// retry should go to cursor (priority 2)
			const retryResult = orch.retryHandoff("ITEM-1");
			expect(retryResult.success).toBe(true);
			expect(retryResult.reEmittedTo).toBe("cursor");

			const wf = loadWorkflow(root);
			expect(wf.items[0].handoff!.executorId).toBe("cursor");
		});
	});
});
