import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceBoundary } from "./workspace-boundary.js";

const roots: string[] = [];

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-boundary-"));
	roots.push(root);
	mkdirSync(join(root, ".letra"), { recursive: true });
	writeFileSync(join(root, ".letra", "constitution.md"), "inside");
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("workspace boundary", () => {
	it("accepts existing and future paths confined to the workspace", () => {
		const root = fixture();
		const boundary = createWorkspaceBoundary(root);

		expect(boundary.assertPath(join(root, ".letra", "constitution.md"))).toContain(".letra");
		expect(boundary.assertPath(join(root, ".letra", "future.json"))).toContain("future.json");
	});

	it("rejects lexical traversal outside the workspace", () => {
		const root = fixture();
		const boundary = createWorkspaceBoundary(root);

		expect(() => boundary.assertPath(join(root, "..", "outside.txt"))).toThrow(
			"outside the workspace boundary",
		);
	});

	it("rejects an in-workspace junction that resolves outside the workspace", () => {
		const root = fixture();
		const outside = mkdtempSync(join(tmpdir(), "letra-boundary-outside-"));
		roots.push(outside);
		writeFileSync(join(outside, "secret.txt"), "outside");
		const linked = join(root, "linked");
		symlinkSync(outside, linked, "junction");

		const boundary = createWorkspaceBoundary(root);
		expect(() => boundary.assertPath(join(linked, "secret.txt"))).toThrow(
			"resolves outside the workspace boundary",
		);
	});
});
