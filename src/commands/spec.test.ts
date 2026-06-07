import { existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { init } from "./init.js";
import { specNew } from "./spec.js";

describe("spec command", () => {
	let tmpDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		tmpDir = join(tmpdir(), `letra-spec-test-${Date.now()}`);
		originalCwd = process.cwd();
		await init(tmpDir);
		process.chdir(tmpDir);
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should create spec directory with required files", async () => {
		const specName = "test-spec";
		await specNew(specName);

		const specDir = join(tmpDir, ".letra", "specs", specName);
		expect(existsSync(specDir)).toBe(true);
		expect(existsSync(join(specDir, "spec.md"))).toBe(true);
		expect(existsSync(join(specDir, "acceptance.md"))).toBe(true);

		const specContent = readFileSync(join(specDir, "spec.md"), "utf-8");
		expect(specContent).toContain(`# Spec: ${specName}`);
		expect(specContent).toContain("## Outcome");
	});

	it("should not overwrite existing spec", async () => {
		const specName = "existing-spec";
		await specNew(specName);

		await expect(specNew(specName)).resolves.not.toThrow();
	});

	it("should create spec with web-api template", async () => {
		await specNew("api-spec", { template: "web-api" });

		const content = readFileSync(
			join(tmpDir, ".letra", "specs", "api-spec", "spec.md"),
			"utf-8",
		);
		expect(content).toContain("RESTful");
		expect(content).toContain("Bearer token JWT");
	});

	it("should create spec with cli-tool template", async () => {
		await specNew("cli-spec", { template: "cli-tool" });

		const content = readFileSync(
			join(tmpDir, ".letra", "specs", "cli-spec", "spec.md"),
			"utf-8",
		);
		expect(content).toContain("Exit codes");
		expect(content).toContain("Cross-platform");
	});

	it("should create spec with mobile-feature template", async () => {
		await specNew("mobile-spec", { template: "mobile-feature" });

		const content = readFileSync(
			join(tmpDir, ".letra", "specs", "mobile-spec", "spec.md"),
			"utf-8",
		);
		expect(content).toContain("iOS 16+");
		expect(content).toContain("Offline-first");
	});

	it("should replace placeholders in templates", async () => {
		const specName = "my-auth";
		await specNew(specName, { template: "web-api" });

		const specContent = readFileSync(
			join(tmpDir, ".letra", "specs", specName, "spec.md"),
			"utf-8",
		);
		expect(specContent).toContain("# Spec: my-auth");
		expect(specContent).not.toContain("{{name}}");

		const acceptanceContent = readFileSync(
			join(tmpDir, ".letra", "specs", specName, "acceptance.md"),
			"utf-8",
		);
		expect(acceptanceContent).toContain("my-auth");
		expect(acceptanceContent).not.toContain("{{name}}");
	});

	it("should exit with error for invalid template", async () => {
		const originalExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
		}) as typeof process.exit;

		await specNew("bad-spec", { template: "nonexistent-template" });

		expect(exitCode).toBe(1);
		process.exit = originalExit;
	});
});
