import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("focus command", () => {
	let tmpDir: string;
	let originalCwd: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-focus-test-${Date.now()}`);
		originalCwd = process.cwd();
		mkdirSync(join(tmpDir, ".letra", "specs"), { recursive: true });
		process.chdir(tmpDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should create focus.md for a valid spec", async () => {
		const specDir = join(tmpDir, ".letra", "specs", "auth");
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "spec.md"),
			"# Spec: Auth\n\n## Outcome\nUser authentication flow.\n",
		);

		const { default: focusCommand } = await import("./focus.js");
		const cmd = focusCommand();

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await cmd.parseAsync(["node", "test", "auth"]);

		const focusFile = join(tmpDir, ".letra", "focus.md");
		expect(existsSync(focusFile)).toBe(true);

		const content = readFileSync(focusFile, "utf-8");
		expect(content).toContain("# Focus: auth");
		expect(content).toContain("**Path**: .letra/specs/auth/");
		expect(content).toContain("User authentication flow.");

		logSpy.mockRestore();
	});

	it("should display current focus", async () => {
		const focusFile = join(tmpDir, ".letra", "focus.md");
		writeFileSync(focusFile, "# Focus: auth\n\n**Path**: .letra/specs/auth/\n");

		const { default: focusCommand } = await import("./focus.js");
		const cmd = focusCommand();

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await cmd.parseAsync(["node", "test"]);

		expect(logSpy).toHaveBeenCalled();
		expect(logSpy.mock.calls.some((call) => call[0].includes("Focus: auth"))).toBe(true);

		logSpy.mockRestore();
	});

	it("should show message when no focus is set", async () => {
		const { default: focusCommand } = await import("./focus.js");
		const cmd = focusCommand();

		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await cmd.parseAsync(["node", "test"]);

		expect(logSpy).toHaveBeenCalled();
		expect(logSpy.mock.calls.some((call) => call[0].includes("Nenhum foco"))).toBe(true);

		logSpy.mockRestore();
	});

	it("should remove focus file with --clear", async () => {
		const focusFile = join(tmpDir, ".letra", "focus.md");
		writeFileSync(focusFile, "# Focus: auth\n");

		const { default: focusCommand } = await import("./focus.js");
		const cmd = focusCommand();

		await cmd.parseAsync(["node", "test", "--clear"]);

		expect(existsSync(focusFile)).toBe(false);
	});

	it("should exit with error for non-existent spec", async () => {
		const { default: focusCommand } = await import("./focus.js");
		const cmd = focusCommand();

		const originalExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
		}) as typeof process.exit;

		await cmd.parseAsync(["node", "test", "non-existent-spec"]);

		expect(exitCode).toBe(1);
		process.exit = originalExit;
	});
});
