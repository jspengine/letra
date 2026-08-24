import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { loadWorkflow } from "./flow-init.js";
import { LINK_FILE, LETRA_FOLDER, resolveWorkspaceRoot } from "../workspace/resolver.js";

function makeTmp(prefix: string): string {
	const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function seedWorkspace(root: string, name: string) {
	mkdirSync(join(root, LETRA_FOLDER, "specs", "demo", ""), { recursive: true });
	writeFileSync(
		join(root, LETRA_FOLDER, "workflow.json"),
		JSON.stringify({
			version: "1.0",
			name,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			stages: [{ id: "todo", name: "Todo", order: 0 }],
			items: [
				{ id: "ITEM-1", description: "demo", stage: "todo", type: "feature", spec: "demo" },
			],
			tools: [],
			primaryItemId: null,
		}),
	);
	writeFileSync(
		join(root, LETRA_FOLDER, "specs", "demo", "spec.md"),
		"# Demo\n- [ ] **AC1.1** foo\n",
	);
}

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
	dirs.length = 0;
});

function cliPath(): string[] {
	// Resolve the built CLI entry (packages/cli/dist/index.js) robustly.
	const candidates = [
		join(process.cwd(), "dist", "index.js"),
		join(process.cwd(), "packages", "cli", "dist", "index.js"),
	];
	for (const c of candidates) if (existsSync(c)) return [process.execPath, c];
	throw new Error("CLI dist not found");
}

describe("CLI integration: externalize via `letra migrate` (ITEM-79)", () => {
	it("migrates a legacy workspace and subsequent CLI commands read the externalized data", () => {
		const root = makeTmp("letra-cli-root");
		dirs.push(root);
		seedWorkspace(root, "CLI Demo");

		const target = makeTmp("letra-cli-target");
		rmSync(target, { recursive: true, force: true });
		dirs.push(target);

		// 1. Run the real CLI: migrate --to <tmp> --clean
		const run = (args: string[]) => {
			const [node, entry] = cliPath();
			return execFileSync(node, [entry, ...args], {
				cwd: root,
				encoding: "utf-8",
				timeout: 15000,
			});
		};

		const legacyPulse = JSON.parse(run(["pulse", "--json"]));
		expect(legacyPulse.workspace).toBe("CLI Demo");
		expect(legacyPulse.dataDir).toBe(join(root, LETRA_FOLDER));
		expect(existsSync(join(root, LINK_FILE))).toBe(false);

		const out = run(["migrate", ".", "--to", target, "--clean"]);
		expect(out).toContain("Migrated");

		// 2. Filesystem outcome
		expect(existsSync(join(target, "workflow.json"))).toBe(true); // data copied outside the project
		expect(existsSync(join(root, LETRA_FOLDER))).toBe(false); // source removed
		expect(readFileSync(join(root, LINK_FILE), "utf-8").trim()).toBe(target); // link points to external dir

		// 3. resolveWorkspaceRoot now sees it as linked/direct
		const res = resolveWorkspaceRoot(root);
		expect(res.type).toBe("linked");
		expect(res.workspaceDir).toBe(target);

		// 4. loadWorkflow picks the externalized workflow.json
		expect(loadWorkflow(root)?.name).toBe("CLI Demo");

		// 5. Another CLI command (sitrep) reads the externalized workflow without error
		//    (execFileSync throws on non-zero exit, which is enough to prove the chain)
		const sitrem = run(["sitrep", "."]);
		expect(existsSync(join(root, LINK_FILE))).toBe(true);
	});
});
