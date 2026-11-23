import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureSecurityBaseline, changedWorkspaceFiles } from "./scoped-review.js";

describe("security baseline with tracked files deleted from the working tree", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "letra-baseline-deleted-"));
		execFileSync("git", ["init", "-q"], { cwd: root });
		writeFileSync(join(root, "kept.ts"), "export const kept = 1;\n");
		writeFileSync(join(root, "removed.ts"), "export const removed = 1;\n");
		execFileSync("git", ["add", "kept.ts", "removed.ts"], { cwd: root });
		unlinkSync(join(root, "removed.ts"));
	});

	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it("records the deleted file instead of leaving the snapshot partial", () => {
		const baseline = captureSecurityBaseline(root);

		expect(baseline.fileSnapshotComplete).toBe(true);
		expect(baseline.files["removed.ts"]).toBe("deleted");
	});

	it("records a tracked gitlink directory without reading it as a file", () => {
		mkdirSync(join(root, "nested-worktree"));
		execFileSync("git", ["update-index", "--add", "--cacheinfo", `160000,${"a".repeat(40)},nested-worktree`], { cwd: root });

		const baseline = captureSecurityBaseline(root);

		expect(baseline.fileSnapshotComplete).toBe(true);
		expect(baseline.files["nested-worktree"]).toBe("directory");
		expect(changedWorkspaceFiles(root, baseline)).toEqual([]);
	});

	it("does not report a still-deleted file as a change, but reports real edits", () => {
		const baseline = captureSecurityBaseline(root);
		expect(changedWorkspaceFiles(root, baseline)).toEqual([]);

		writeFileSync(join(root, "kept.ts"), "export const kept = 2;\n");
		expect(changedWorkspaceFiles(root, baseline)).toEqual(["kept.ts"]);
	});
});
