/**
 * ITEM-39 AC6: no client computes a revision on its own. Outside
 * agent-direction/, a revision must come from the canonical operation
 * direction (resolveOperationDirection / directionForOperation /
 * directionForRunAwareOperation), never from `resolveAgentDirection(...)` or
 * `resolveDirection(...)` directly: those diverged from what the operations
 * compare once an item had an active Run.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORBIDDEN = /\b(resolveAgentDirection|resolveDirection)\([^;]*?\)\s*\.revision\b/;

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
	});
}

describe("revision architecture (ITEM-39 AC6)", () => {
	it("derives revisions only from the canonical operation direction outside agent-direction/", () => {
		// agent-direction/ owns the resolvers; test/ helpers act as clients and
		// read the public query on purpose (`letra direction --item`).
		const offenders = sourceFiles(srcRoot)
			.filter((path) => {
				const rel = relative(srcRoot, path).replace(/\\/g, "/");
				return !rel.startsWith("agent-direction/") && !rel.startsWith("test/");
			})
			.flatMap((path) =>
				readFileSync(path, "utf8")
					.split("\n")
					.map((line, index) => ({ line, index }))
					.filter(({ line }) => FORBIDDEN.test(line))
					.map(({ index }) => `${relative(srcRoot, path).replace(/\\/g, "/")}:${index + 1}`),
			);
		expect(offenders).toEqual([]);
	});

	it("detects the forbidden pattern", () => {
		expect(FORBIDDEN.test("expectedRevision: resolveAgentDirection(root, itemId).revision,")).toBe(true);
		expect(FORBIDDEN.test("expectedRevision: resolveDirection(root).revision,")).toBe(true);
		expect(FORBIDDEN.test("expectedRevision: directionForOperation(root, { itemId }).revision,")).toBe(false);
	});
});
