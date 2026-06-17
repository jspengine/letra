import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { init } from "./init.js";

describe("init command", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-init-test-${Date.now()}`);
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should create .letra directory with required files", async () => {
		await init(tmpDir);

		expect(existsSync(join(tmpDir, ".letra"))).toBe(true);
		expect(existsSync(join(tmpDir, ".letra", "context.md"))).toBe(true);
		expect(existsSync(join(tmpDir, ".letra", "constitution.md"))).toBe(true);
		expect(existsSync(join(tmpDir, ".letra", "glossary.md"))).toBe(true);
		expect(existsSync(join(tmpDir, ".letra", "specs", "_template.md"))).toBe(true);
	});

	it("should generate Cursor adapter", async () => {
		await init(tmpDir);
		expect(existsSync(join(tmpDir, ".cursorrules"))).toBe(true);

		const content = readFileSync(join(tmpDir, ".cursorrules"), "utf-8");
		expect(content).toContain("Letra Context — Cursor Adapter");
		expect(content).toContain("@.letra/context.md");
	});

	it("should generate Claude Code adapter", async () => {
		await init(tmpDir);
		expect(existsSync(join(tmpDir, "CLAUDE.md"))).toBe(true);

		const content = readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8");
		expect(content).toContain("Letra Context — Claude Code Adapter");
		expect(content).toContain(".letra/context.md");
	});

	it("should generate Windsurf adapter", async () => {
		await init(tmpDir);
		expect(existsSync(join(tmpDir, ".windsurfrules"))).toBe(true);

		const content = readFileSync(join(tmpDir, ".windsurfrules"), "utf-8");
		expect(content).toContain("Letra Context — Windsurf Adapter");
		expect(content).toContain(".letra/context.md");
	});

	it("should generate VSCode adapter files for Node.js projects", async () => {
		mkdirSync(tmpDir, { recursive: true });
		writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
		await init(tmpDir);
		expect(existsSync(join(tmpDir, ".github", "copilot-instructions.md"))).toBe(true);
		expect(existsSync(join(tmpDir, ".vscode", "settings.json"))).toBe(true);
	});

	it("should not generate VSCode settings for non-Node projects", async () => {
		await init(tmpDir);
		expect(existsSync(join(tmpDir, ".vscode", "settings.json"))).toBe(false);
	});
});
