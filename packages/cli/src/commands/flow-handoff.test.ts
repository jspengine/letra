import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handoffItem } from "./flow-handoff.js";
import { loadWorkflow } from "./flow-init.js";

const roots: string[] = [];

function tempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-handoff-"));
	roots.push(root);
	mkdirSync(join(root, ".letra"), { recursive: true });
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function createWorkflow(root: string, overrides?: Partial<Parameters<typeof handoffItem>[2]> & { items?: Array<Record<string, unknown>> }) {
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
				claimedBy: "opencode",
				claimedAt: "2026-01-01T00:00:00.000Z",
			},
		],
		tools: [],
		...overrides,
	};
	writeFileSync(join(root, "workflow.json"), JSON.stringify(workflow, null, 2));
	return workflow;
}

describe("FlowHandoff", () => {
	it("creates handoff with valid input", async () => {
		const root = tempRoot();
		createWorkflow(root);

		await handoffItem(root, "ITEM-1", {
			to: "reviewer",
			summary: "Implementation complete",
			evidence: ["src/test.ts"],
		});

		const workflow = loadWorkflow(root)!;
		const item = workflow.items.find((i) => i.id === "ITEM-1");
		expect(item).toBeDefined();
		expect(item?.handoff).toBeDefined();
		expect(item?.handoff?.from).toBe("opencode");
		expect(item?.handoff?.to).toBe("reviewer");
		expect(item?.handoff?.summary).toBe("Implementation complete");
		expect(item?.handoff?.evidence).toEqual(["src/test.ts"]);
		expect(item?.handoff?.expiresAt).toBeDefined();
	});

	it("rolls back handoff", async () => {
		const root = tempRoot();
		createWorkflow(root);

		await handoffItem(root, "ITEM-1", {
			to: "reviewer",
			summary: "Implementation complete",
		});

		const workflow1 = loadWorkflow(root)!;
		expect(workflow1.items[0].handoff).toBeDefined();

		await handoffItem(root, "ITEM-1", {
			to: "",
			summary: "Rollback",
			rollback: true,
		});

		const workflow2 = loadWorkflow(root)!;
		const item = workflow2.items.find((i) => i.id === "ITEM-1");
		expect(item?.handoff).toBeUndefined();
		expect(item?.claimedBy).toBe("opencode");
	});

	it("fails for completed item", async () => {
		const root = tempRoot();
		createWorkflow(root, {
			items: [
				{
					id: "ITEM-1",
					description: "Test item",
					stage: "done",
					createdAt: "2026-01-01T00:00:00.000Z",
				},
			],
		});

		await expect(
			handoffItem(root, "ITEM-1", {
				to: "reviewer",
				summary: "Test",
			}),
		).rejects.toThrow();
	});

	it("fails for missing item", async () => {
		const root = tempRoot();
		createWorkflow(root);

		await expect(
			handoffItem(root, "ITEM-999", {
				to: "reviewer",
				summary: "Test",
			}),
		).rejects.toThrow();
	});

	it.skip("fails when gate blocks handoff", async () => {
		const root = tempRoot();
		createWorkflow(root);

		const harnessDir = join(root, "harness");
		mkdirSync(join(harnessDir, "gates"), { recursive: true });
		writeFileSync(
			join(harnessDir, "gates", "code-reviewed.yaml"),
			"id: code-reviewed\nname: Code Reviewed\ntype: automated\nblocking: true\nblocksHandoff: true\nstatus: pending\n",
		);

		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const processSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

		await handoffItem(root, "ITEM-1", {
			to: "reviewer",
			summary: "Test",
		});

		expect(processSpy).toHaveBeenCalledWith(1);
		const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1];
		expect(lastCall[0]).toContain("Cannot handoff");

		consoleSpy.mockRestore();
		processSpy.mockRestore();
	});

	it("allows handoff when gate does not block", async () => {
		const root = tempRoot();
		createWorkflow(root);

		mkdirSync(join(root, ".letra", "harness", "gates"), { recursive: true });
		writeFileSync(
			join(root, ".letra", "harness", "gates", "code-reviewed.yaml"),
			"id: code-reviewed\nname: Code Reviewed\ntype: automated\nblocking: true\nblocksHandoff: false\nstatus: pending\n",
		);

		await handoffItem(root, "ITEM-1", {
			to: "reviewer",
			summary: "Test",
		});

		const workflow = loadWorkflow(root)!;
		expect(workflow.items[0].handoff).toBeDefined();
	});
});
