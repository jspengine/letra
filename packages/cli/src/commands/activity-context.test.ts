import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import activityContextCommand from "./activity-context.js";

function createTestDir(): string {
	const dir = join(
		tmpdir(),
		`letra-activity-context-cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(join(dir, ".letra", "specs"), { recursive: true });
	return dir;
}

function writeWorkflow(dir: string) {
	writeFileSync(
		join(dir, ".letra", "workflow.json"),
		JSON.stringify(
			{
				version: "1.0",
				name: "letra-test",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				stages: [
					{ id: "backlog", name: "Backlog", order: 0, zone: "todo" },
					{ id: "design", name: "Design", order: 1, zone: "doing" },
					{ id: "done", name: "Done", order: 2, zone: "done" },
				],
				items: [
					{
						id: "ITEM-47",
						description: "Activity Context core",
						stage: "design",
						createdAt: new Date().toISOString(),
						spec: "activity-context",
					},
				],
				tools: ["opencode"],
			},
			null,
			2,
		),
		"utf-8",
	);
}

function writeSpec(dir: string) {
	const specDir = join(dir, ".letra", "specs", "activity-context");
	mkdirSync(specDir, { recursive: true });
	writeFileSync(
		join(specDir, "spec.md"),
		[
			"# Spec: activity-context",
			"",
			"## Outcome",
			"Entregar contexto situacional por atividade.",
			"",
			"## Acceptance Criteria",
			"- [ ] **AC1**: Builder existe",
		].join("\n"),
		"utf-8",
	);
}

describe("activity-context command", () => {
	let dir: string;
	let logSpy: ReturnType<typeof vi.spyOn>;
	const originalCwd = process.cwd();

	beforeEach(() => {
		dir = createTestDir();
		writeFileSync(join(dir, ".letra", "context.md"), "# Context\n", "utf-8");
		writeFileSync(join(dir, ".letra", "constitution.md"), "# Constitution\n", "utf-8");
		writeWorkflow(dir);
		writeSpec(dir);
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		process.chdir(dir);
	});

	afterEach(() => {
		logSpy.mockRestore();
		process.chdir(originalCwd);
		rmSync(dir, { recursive: true, force: true });
	});

	it("prints text output by default", async () => {
		const command = activityContextCommand();

		await command.parseAsync(["node", "activity-context"], { from: "user" });

		const output = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
		expect(output).toContain("# Activity Context: implement");
		expect(output).toContain("Item: ITEM-47");
		expect(output).toContain("Must Read:");
	});

	it("prints json when requested", async () => {
		const command = activityContextCommand();

		await command.parseAsync(
			["node", "activity-context", "--format", "json", "--activity", "design"],
			{ from: "user" },
		);

		const output = logSpy.mock.calls[0]?.[0];
		expect(typeof output).toBe("string");
		expect(String(output)).toContain('"activity": "design"');
		expect(String(output)).toContain('"currentItem"');
	});
});
