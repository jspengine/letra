import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearFocusFile, extractOutcome, readFocusFile, writeFocusFile } from "./focus-sync.js";

describe("focus-sync", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-focus-sync-test-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra", "specs", "auth"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should extract outcome from spec.md", () => {
		writeFileSync(
			join(tmpDir, ".letra", "specs", "auth", "spec.md"),
			"# Spec: Auth\n\n## Outcome\nAllows users to log in securely.\n\n## Constraints\nBlabla\n",
		);

		const outcome = extractOutcome(tmpDir, "auth");
		expect(outcome).toBe("Allows users to log in securely.");
	});

	it("should write focus file correctly and read it back", () => {
		writeFileSync(
			join(tmpDir, ".letra", "specs", "auth", "spec.md"),
			"# Spec: Auth\n\n## Outcome\nAllows users to log in securely.\n",
		);

		writeFocusFile(tmpDir, "auth", "ITEM-123");

		const focusFile = join(tmpDir, ".letra", "focus.md");
		expect(existsSync(focusFile)).toBe(true);

		const rawContent = readFileSync(focusFile, "utf-8");
		expect(rawContent).toContain("# Focus: auth");
		expect(rawContent).toContain("**Path**: .letra/specs/auth/");
		expect(rawContent).toContain("**Item**: ITEM-123");
		expect(rawContent).toContain("**Outcome**: Allows users to log in securely.");

		const parsed = readFocusFile(tmpDir);
		expect(parsed).not.toBeNull();
		expect(parsed?.specName).toBe("auth");
		expect(parsed?.itemId).toBe("ITEM-123");
		expect(parsed?.outcome).toBe("Allows users to log in securely.");
	});

	it("should clear focus file", () => {
		const focusFile = join(tmpDir, ".letra", "focus.md");
		writeFileSync(focusFile, "# Focus: dummy\n");
		expect(existsSync(focusFile)).toBe(true);

		clearFocusFile(tmpDir);
		expect(existsSync(focusFile)).toBe(false);
	});
});
