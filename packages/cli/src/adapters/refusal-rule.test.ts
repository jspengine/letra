import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncNow } from "../commands/sync.js";
import { clearWorkspaceCache } from "../workspace/resolver.js";
import { buildHarnessSnapshot } from "./builder.js";
import { renderLetraHarnessSkill } from "./codex-bootstrap.js";
import { formatAdapterContent } from "./formatters.js";
import { renderAdapterFiles, supportedAdapterTools } from "./generate.js";
import { REFUSAL_RULE_HEADING, REFUSAL_RULE_LINES } from "./refusal-rule.js";

// ITEM-55 (spec bootstrap-ensina-recusas): every agent instruction file tells
// the agent what to do with a refusal, from one canonical text.

const roots: string[] = [];
afterEach(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
	clearWorkspaceCache();
});

function tempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	roots.push(dir);
	return dir;
}

function expectRefusalRule(content: string, where: string) {
	expect(content, where).toContain(REFUSAL_RULE_HEADING);
	for (const line of REFUSAL_RULE_LINES) expect(content, where).toContain(line);
}

describe("AC1 — canonical rule", () => {
	it("says what to do with nextCommand and humanRequired, and forbids acting as a human", () => {
		const rule = REFUSAL_RULE_LINES.join("\n");
		expect(rule).toContain("run `nextCommand` as given");
		expect(rule).toContain("`humanRequired: true`: stop and ask the human");
		expect(rule).toContain("Never retry with a human identity");
		expect(rule).toContain("Do not read Letra source code");
	});
});

describe("AC2 — every generator carries the rule", () => {
	it("every generated instruction artifact of every supported tool", () => {
		const root = tempDir("letra-refusal-rule-");
		const tools = supportedAdapterTools().map((tool) => tool.id);
		const files = renderAdapterFiles(root, tools, { source: "init", quiet: true });
		const instructions = files.filter((file) => !file.path.endsWith(".toml"));
		expect(instructions.length).toBeGreaterThanOrEqual(tools.length);
		for (const file of instructions) expectRefusalRule(file.content, file.path);
	});

	it("the Codex skill", () => {
		expectRefusalRule(renderLetraHarnessSkill(), "SKILL.md");
	});

	it("formatAdapterContent, with and without a workflow", () => {
		const bare = tempDir("letra-refusal-format-");
		const withoutWorkflow = formatAdapterContent(buildHarnessSnapshot(bare, { source: "init" }), "text", { source: "init", displayName: "Cursor" });
		expectRefusalRule(withoutWorkflow, "no workflow");

		const snapshot = buildHarnessSnapshot(bare, {
			source: "flow-move",
			workflow: {
				name: "Rule",
				stages: [{ id: "code", name: "Code" }],
				items: [{ id: "ITEM-1", description: "Task", stage: "code" }],
			},
			activeStageId: "code",
		});
		expect(snapshot.hasWorkflow).toBe(true);
		expectRefusalRule(formatAdapterContent(snapshot, "at", { source: "flow-move", displayName: "Cursor" }), "with workflow");
	});
});

describe("AC3 — letra sync regenerates with the rule and stays task-free", () => {
	it("rewrites a stale AGENTS.md with the rule and no item, stage or AC", async () => {
		const root = tempDir("letra-refusal-sync-");
		writeFileSync(join(root, "workflow.json"), JSON.stringify({ version: "1.0", name: "Sync", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", stages: [{ id: "code", name: "Code", order: 0 }], items: [], tools: [] }));
		writeFileSync(join(root, "AGENTS.md"), "# Gerado por letra flow move. Nao edite manualmente.\n# Letra Session — Letra\n\nItem: ITEM-23\n");
		const synced = await syncNow(root);
		expect(synced.ok).toBe(true);
		const content = readFileSync(join(root, "AGENTS.md"), "utf8");
		expectRefusalRule(content, "AGENTS.md after sync");
		expect(content).toContain("# Letra Agent Bootstrap");
		expect(content).not.toMatch(/ITEM-\d+|\bAC\d+\b/);
	});
});
