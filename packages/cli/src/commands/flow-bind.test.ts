import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveActiveFlow } from "../flow-definition/resolve.js";
import { flowBind } from "./flow-bind.js";
import { loadWorkflow, saveWorkflow, type Workflow } from "./flow-init.js";

function createWorkflow(): Workflow {
	return {
		version: "1.0",
		name: "test",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		stages: [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
			{ id: "code", name: "Code", order: 1, zone: "doing" },
			{ id: "review", name: "Review", order: 2, zone: "doing" },
			{ id: "done", name: "Done", order: 3, zone: "done" },
		],
		items: [
			{
				id: "ITEM-1",
				description: "Test item",
				stage: "review",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
		],
		tools: [],
	};
}

function writeHarness(root: string, version: string, includeReview = true): void {
	const harnessRoot = join(root, ".letra", "harness", version);
	mkdirSync(join(harnessRoot, "flows"), { recursive: true });
	mkdirSync(join(harnessRoot, "gates"), { recursive: true });
	mkdirSync(join(harnessRoot, "roles"), { recursive: true });
	const stages = [
		"  - id: backlog\n    name: Backlog\n    order: 0\n    zone: todo",
		'  - id: code\n    name: Code\n    order: 1\n    zone: doing\n    agents: ["builder"]',
		includeReview
			? '  - id: review\n    name: Review\n    order: 2\n    zone: doing\n    agents: ["reviewer"]'
			: "",
		"  - id: done\n    name: Done\n    order: 3\n    zone: done",
	].filter(Boolean);
	writeFileSync(
		join(harnessRoot, "flows", "flow-main.yaml"),
		[
			"id: flow-main",
			"version: 0.1.1",
			"name: Main Flow",
			"description: Test flow",
			"defaultPolicy: default",
			"stages:",
			...stages,
		].join("\n"),
	);
}

describe("flow-bind", () => {
	let root: string;

	beforeEach(() => {
		root = join(tmpdir(), `letra-flow-bind-${Date.now()}`);
		mkdirSync(root, { recursive: true });
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (existsSync(root)) rmSync(root, { recursive: true, force: true });
	});

	it("binds a compatible workflow to a versioned harness without moving items", async () => {
		saveWorkflow(root, createWorkflow());
		writeHarness(root, "v0.1.1");

		const result = await flowBind(root, {
			template: "flow-main",
			harnessVersion: "v0.1.1",
		});

		expect(result).toBe(true);
		const workflow = loadWorkflow(root);
		expect(workflow?.template).toBe("flow-main");
		expect(workflow?.harnessVersion).toBe("v0.1.1");
		expect(workflow?.items[0].stage).toBe("review");

		const resolved = resolveActiveFlow(root);
		expect(resolved.flow?.source).toBe("workflow-template");
		expect(resolved.flow?.harnessVersion).toBe("v0.1.1");
		expect(resolved.flow?.templateVersion).toBe("0.1.1");
		expect(resolved.flow?.stages.find((stage) => stage.id === "review")?.agents).toEqual([
			"reviewer",
		]);
	});

	it("rejects a template that does not contain every referenced stage", async () => {
		saveWorkflow(root, createWorkflow());
		writeHarness(root, "v0.1.1", false);

		const result = await flowBind(root, {
			template: "flow-main",
			harnessVersion: "v0.1.1",
		});

		expect(result).toBe(false);
		expect(loadWorkflow(root)?.template).toBeUndefined();
		expect(console.log).toHaveBeenCalledWith(expect.stringContaining("review"));
	});
});
