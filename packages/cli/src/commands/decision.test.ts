import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function sanitizeTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

describe("decision command", () => {
	let tmpDir: string;
	let originalCwd: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-decision-test-${Date.now()}`);
		originalCwd = process.cwd();
		mkdirSync(join(tmpDir, ".letra", "decisions"), { recursive: true });
		process.chdir(tmpDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should create a decision file with correct slug", async () => {
		const { default: decisionCommand } = await import("./decision.js");
		const cmd = decisionCommand();
		const title = "Usar Commander em vez de Yargs";
		await cmd.parseAsync(["node", "test", "new", title]);

		const slug = sanitizeTitle(title);
		const filePath = join(tmpDir, ".letra", "decisions", `${slug}.md`);
		expect(existsSync(filePath)).toBe(true);

		const content = readFileSync(filePath, "utf-8");
		expect(content).toContain("# Usar Commander em vez de Yargs");
		expect(content).toContain("**Status**: proposed");
		expect(content).toContain("## Context");
		expect(content).toContain("## Decision");
		expect(content).toContain("## Consequences");
	});

	it("should not overwrite an existing decision", async () => {
		const { default: decisionCommand } = await import("./decision.js");
		const cmd = decisionCommand();
		const title = "Decisao Existente";
		await cmd.parseAsync(["node", "test", "new", title]);
		await cmd.parseAsync(["node", "test", "new", title]);

		const slug = sanitizeTitle(title);
		const filePath = join(tmpDir, ".letra", "decisions", `${slug}.md`);
		expect(existsSync(filePath)).toBe(true);
	});

	it("should list decisions", async () => {
		const { default: decisionCommand } = await import("./decision.js");
		const cmd = decisionCommand();

		writeFileSync(
			join(tmpDir, ".letra", "decisions", "test-decision.md"),
			"# Test Decision\n",
		);

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await cmd.parseAsync(["node", "test", "list"]);
		expect(logSpy).toHaveBeenCalled();
		expect(
			logSpy.mock.calls.some((call) => call[0].includes("test-decision")),
		).toBe(true);

		logSpy.mockRestore();
	});

	it("should show message when no decisions exist", async () => {
		const { default: decisionCommand } = await import("./decision.js");
		const cmd = decisionCommand();

		rmSync(join(tmpDir, ".letra", "decisions"), {
			recursive: true,
			force: true,
		});

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await cmd.parseAsync(["node", "test", "list"]);
		expect(logSpy).toHaveBeenCalled();
		expect(
			logSpy.mock.calls.some((call) => call[0].includes("No decisions")),
		).toBe(true);

		logSpy.mockRestore();
	});

	it("should create decisions directory if it does not exist", async () => {
		rmSync(join(tmpDir, ".letra", "decisions"), {
			recursive: true,
			force: true,
		});

		const { default: decisionCommand } = await import("./decision.js");
		const cmd = decisionCommand();
		await cmd.parseAsync(["node", "test", "new", "Nova Decisao"]);

		expect(existsSync(join(tmpDir, ".letra", "decisions"))).toBe(true);
	});
});
