import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
});
