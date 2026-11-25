import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { push } from "./push.js";
import { LINK_FILE } from "../workspace/resolver.js";

const roots: string[] = [];
function makeDir(prefix: string): string {
	const path = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(path, { recursive: true });
	roots.push(path);
	return path;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("push preserves external workspace governance", () => {
	it("keeps specs and adapter instructions out of a linked project checkout", async () => {
		const project = makeDir("letra-push-project");
		const dataDir = makeDir("letra-push-data");
		mkdirSync(join(dataDir, "specs", "only-in-workspace"), { recursive: true });
		writeFileSync(join(dataDir, "specs", "only-in-workspace", "spec.md"), "# Workspace spec\n");
		writeFileSync(join(project, LINK_FILE), `${dataDir}\n`);
		writeFileSync(join(dataDir, "workflow.json"), JSON.stringify({
			version: "1.0",
			name: "Push test",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			stages: [{ id: "code", name: "Code", order: 0 }],
			items: [],
			tools: ["opencode"],
			locations: [{ id: "loc-project", label: "project", path: project, adapters: ["opencode"] }],
			primaryItemId: null,
		}));

		await push(project, { quiet: true });

		expect(existsSync(join(project, ".letra"))).toBe(false);
		expect(existsSync(join(project, "AGENTS.md"))).toBe(false);
		expect(existsSync(join(dataDir, "specs", "only-in-workspace", "spec.md"))).toBe(true);
		expect(existsSync(join(dataDir, "adapters", "opencode"))).toBe(true);
	});
});
