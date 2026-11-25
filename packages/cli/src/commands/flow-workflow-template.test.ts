import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWorkflowDefinitions, getWorkflowDraft } from "../workflow-versions/service.js";
import { workflowTemplateCommand } from "./flow-workflow.js";

const HARNESS_SOURCE = join(__dirname, "..", "harness", "default", "v0.2.0");

describe("letra flow workflow template", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "letra-workflow-template-"));
		const harness = join(root, ".letra", "harness", "v0.2.0");
		mkdirSync(harness, { recursive: true });
		cpSync(HARNESS_SOURCE, harness, { recursive: true });
		vi.spyOn(console, "log").mockImplementation(() => undefined);
		process.exitCode = undefined;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		process.exitCode = undefined;
		rmSync(root, { recursive: true, force: true });
	});

	it("records the harness template so the board can copy its stages", () => {
		workflowTemplateCommand(root, "ignored", "human:owner", "flow-main", { name: "Fluxo principal" });

		const [definition] = listWorkflowDefinitions(root);
		const draft = getWorkflowDraft(root, definition.id);
		expect(draft.content.name).toBe("Fluxo principal");
		expect(draft.content.template).toBe("flow-main");
		expect(Array.isArray(draft.content.stages)).toBe(false);
		expect(process.exitCode).toBeUndefined();
	});

	it("rejects a template that the harness does not provide", () => {
		workflowTemplateCommand(root, "ignored", "human:owner", "does-not-exist", {});

		expect(listWorkflowDefinitions(root)).toHaveLength(0);
		expect(process.exitCode).toBe(1);
	});

	it("requires a template name", () => {
		workflowTemplateCommand(root, "ignored", "human:owner", "", {});

		expect(listWorkflowDefinitions(root)).toHaveLength(0);
		expect(process.exitCode).toBe(1);
	});

	it("keeps explicit stages when they are given", () => {
		workflowTemplateCommand(root, "ignored", "human:owner", "flow-main", { stages: ["todo", "done"] });

		const [definition] = listWorkflowDefinitions(root);
		const draft = getWorkflowDraft(root, definition.id);
		expect(draft.content.stages.map((stage) => stage.id)).toEqual(["todo", "done"]);
	});
});
