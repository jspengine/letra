import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { clearWorkspaceCache } from "../workspace/resolver.js";
import { syncMirror } from "./sync.js";

const roots: string[] = [];
function fixture() {
	const root = join(tmpdir(), `letra-sync-${randomUUID()}`);
	const data = join(tmpdir(), `letra-sync-data-${randomUUID()}`);
	mkdirSync(join(root, ".letra"), { recursive: true });
	mkdirSync(data, { recursive: true });
	writeFileSync(join(root, ".letra-link"), `${data}\n`);
	writeFileSync(join(data, "workflow.json"), JSON.stringify({ version: "1", items: [] }, null, 2));
	roots.push(root, data);
	return { root, data };
}

afterEach(() => {
	clearWorkspaceCache();
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("sync mirror", () => {
	it("workspace-to-location materializes the projection and reports only changed files", () => {
		const { root, data } = fixture();
		const dry = syncMirror(root, { direction: "workspace-to-location", dryRun: true });
		expect(dry.ok).toBe(true);
		expect(dry.filesUpdated).toEqual([join(root, ".letra", "workflow.json")]);
		expect(existsSync(join(root, ".letra", "workflow.json"))).toBe(false);

		const applied = syncMirror(root, { direction: "workspace-to-location", backup: true });
		expect(applied.code).toBe("WORKSPACE_SYNCED");
		expect(applied.filesUpdated).toEqual([join(root, ".letra", "workflow.json")]);
		expect(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).toBe(readFileSync(join(data, "workflow.json"), "utf8"));
	});

	it("location-to-workspace refuses a substantive projection conflict", () => {
		const { root, data } = fixture();
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify({ version: "2", items: [] }));
		const result = syncMirror(root, { direction: "location-to-workspace" });
		expect(result).toMatchObject({ ok: false, code: "WORKSPACE_SYNC_CONFLICT", filesUpdated: [] });
		expect(JSON.parse(readFileSync(join(data, "workflow.json"), "utf8")).version).toBe("1");
	});

	it("uses the shared invalid-link diagnosis and preserves the local projection", () => {
		const root = join(tmpdir(), `letra-sync-invalid-${randomUUID()}`);
		const localWorkflow = JSON.stringify({ version: "local", items: [{ id: "LOCAL" }] }, null, 2);
		mkdirSync(join(root, ".letra"), { recursive: true });
		writeFileSync(join(root, ".letra-link"), "missing-canonical-workspace\n");
		writeFileSync(join(root, ".letra", "workflow.json"), localWorkflow);
		roots.push(root);

		const result = syncMirror(root, { direction: "workspace-to-location" });

		expect(result).toMatchObject({
			ok: false,
			code: "WORKSPACE_LINK_INVALID",
			filesUpdated: [],
			report: {
				code: "WORKSPACE_LINK_INVALID",
				drifts: [expect.objectContaining({
					paths: expect.arrayContaining([join(root, ".letra-link")]),
					recovery: expect.stringContaining("letra sync --mirror link-to-workspace"),
				})],
			},
		});
		expect(readFileSync(join(root, ".letra", "workflow.json"), "utf8")).toBe(localWorkflow);
	});
});
