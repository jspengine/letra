import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sitrep } from "./sitrep.js";

describe("sitrep", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-sitrep-test-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	function writeContext(content: string): void {
		writeFileSync(join(tmpDir, ".letra", "context.md"), content, "utf-8");
	}

	function writeWorkflow(): void {
		writeFileSync(
			join(tmpDir, ".letra", "workflow.json"),
			JSON.stringify({
				name: "test-project",
				stages: [
					{ id: "backlog", order: 0 },
					{ id: "code", order: 1 },
					{ id: "done", order: 2 },
				],
				items: [
					{ id: "ITEM-1", description: "Feature X", stage: "code", spec: "feature-x" },
					{ id: "ITEM-2", description: "Bug Y", stage: "backlog" },
				],
			}),
		);
	}

	it("prints a live summary without writing context.md", async () => {
		const original = `# Context

## Intent

Manual intent text
`;
		writeContext(original);
		writeWorkflow();

		const log = console.log;
		const messages: string[] = [];
		console.log = (msg: string) => messages.push(String(msg));

		await sitrep(tmpDir, { skipLog: true });

		console.log = log;
		const content = readFileSync(join(tmpDir, ".letra", "context.md"), "utf-8");
		expect(content).toBe(original);
		expect(messages.some((m) => m.includes("não atualiza mais context.md"))).toBe(true);
		expect(messages.some((m) => m.includes("ITEM-1"))).toBe(true);
		expect(messages.some((m) => m.includes("Feature X"))).toBe(true);
	}, 15000);

	it("works without context.md because context is no longer live state", async () => {
		writeWorkflow();

		const log = console.log;
		const messages: string[] = [];
		console.log = (msg: string) => messages.push(String(msg));

		await sitrep(tmpDir, { skipLog: true });

		console.log = log;
		expect(messages.some((m) => m.includes("Resumo vivo atual"))).toBe(true);
		expect(messages.some((m) => m.includes("ITEM-1"))).toBe(true);
	});

	it("does not log when skipLog is true", async () => {
		writeWorkflow();

		await sitrep(tmpDir, { quiet: true, skipLog: true });

		expect(existsSync(join(tmpDir, ".letra", "session-log.json"))).toBe(false);
	});
});
