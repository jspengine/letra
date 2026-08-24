import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	CANONICAL_WORKSPACE_DIRS,
	CANONICAL_WORKSPACE_FILES,
	ensureExternalWorkspaceLayout,
} from "./index.js";

const dirs: string[] = [];

function tempDir(prefix: string): string {
	const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	dirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("external workspace layout", () => {
	it("creates the canonical ITEM-79 data directory shape", () => {
		const dataDir = tempDir("letra-layout");

		ensureExternalWorkspaceLayout(dataDir, {
			workspace: { id: "ws_1", name: "Demo", createdAt: "2026-01-01T00:00:00.000Z" },
			workflow: {
				version: "1.0",
				name: "Demo",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
				stages: [],
				items: [],
				tools: [],
			},
		});

		for (const dir of CANONICAL_WORKSPACE_DIRS) {
			expect(existsSync(join(dataDir, dir))).toBe(true);
		}
		for (const file of CANONICAL_WORKSPACE_FILES) {
			expect(existsSync(join(dataDir, file))).toBe(true);
		}
	});
});
