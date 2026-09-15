import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Workflow } from "../commands/flow-init.js";
import { resolveExecutionWorkspace } from "./execution-workspace.js";

const roots: string[] = [];
function workspace(): Workflow {
	return { version: "1", name: "test", createdAt: "", updatedAt: "", stages: [], items: [], tools: [] };
}
function gitRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-execution-root-"));
	roots.push(root);
	execFileSync("git", ["init", root], { stdio: "ignore" });
	return root;
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("execution workspace resolution", () => {
	it("uses the selected canonical location rather than the external harness directory", () => {
		const source = gitRoot();
		const data = mkdtempSync(join(tmpdir(), "letra-external-data-")); roots.push(data);
		const result = resolveExecutionWorkspace({ workflow: { ...workspace(), locations: [{ id: "source", path: source, label: "source", adapters: ["codex"] }] }, workspaceRoot: data, selectedDirectory: source });
		expect(result).toMatchObject({ ok: true, root: source });
	});

	it("rejects an unregistered or untrusted execution directory before work starts", () => {
		const source = gitRoot();
		const other = mkdtempSync(join(tmpdir(), "letra-not-git-")); roots.push(other);
		expect(resolveExecutionWorkspace({ workflow: { ...workspace(), locations: [{ id: "source", path: source, label: "source", adapters: [] }] }, workspaceRoot: other, selectedDirectory: other })).toMatchObject({ ok: false, reasonCode: "EXECUTION_WORKSPACE_UNAVAILABLE" });
		expect(resolveExecutionWorkspace({ workflow: { ...workspace(), locations: [{ id: "other", path: other, label: "other", adapters: [] }] }, workspaceRoot: other })).toMatchObject({ ok: false, reasonCode: "EXECUTION_WORKSPACE_UNTRUSTED" });
	});
});
