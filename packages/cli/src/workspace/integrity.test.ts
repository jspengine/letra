import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inspectWorkspaceIntegrity, normalizedHash } from "./integrity.js";
import { resolveAgentDirection } from "../agent-direction/service.js";

function fixture() {
	const root = join(tmpdir(), `letra-integrity-${randomUUID()}`);
	const data = join(tmpdir(), `letra-data-${randomUUID()}`);
	mkdirSync(join(root, ".letra"), { recursive: true });
	mkdirSync(data, { recursive: true });
	writeFileSync(join(root, ".letra-link"), `${data}\r\n`);
	writeFileSync(
		join(data, "workflow.json"),
		JSON.stringify({ version: "1", items: [], updatedAt: "one" }),
	);
	return { root, data };
}

describe("workspace integrity", () => {
	it("resolves a linked workspace and reports resolution metadata", () => {
		const { root, data } = fixture();
		try {
			const report = inspectWorkspaceIntegrity(root);
			expect(report.ok).toBe(true);
			expect(report.resolution).toMatchObject({
				workspaceDir: data,
				locationPath: root,
				mode: "linked",
			});
			expect(report.pathsTried).toContain(join(root, ".letra-link"));
		} finally {
			rmSync(root, { recursive: true, force: true });
			rmSync(data, { recursive: true, force: true });
		}
	});

	it("uses the canonical workspace root in direction metadata", () => {
		const { root, data } = fixture();
		try {
			const direction = resolveAgentDirection(root);
			expect(direction.source).toMatchObject({
				workspaceRoot: data.replace(/\\/g, "/"),
				workspaceDir: data.replace(/\\/g, "/"),
				locationPath: root.replace(/\\/g, "/"),
				resolutionMode: "linked",
			});
		} finally {
			rmSync(root, { recursive: true, force: true });
			rmSync(data, { recursive: true, force: true });
		}
	});

	it("normalizes CRLF and volatile workflow fields before hashing", () => {
		const { root, data } = fixture();
		try {
			const canonical = join(data, "workflow.json");
			const projection = join(root, ".letra", "workflow.json");
			writeFileSync(
				projection,
				JSON.stringify({ updatedAt: "two", items: [], version: "1" }).replace(
					/\n/g,
					"\r\n",
				),
			);
			expect(normalizedHash(canonical)).toBe(normalizedHash(projection));
			expect(inspectWorkspaceIntegrity(root).drifts).toHaveLength(0);
		} finally {
			rmSync(root, { recursive: true, force: true });
			rmSync(data, { recursive: true, force: true });
		}
	});

	it("returns actionable drift with stable code and recovery", () => {
		const { root, data } = fixture();
		try {
			writeFileSync(
				join(root, ".letra", "workflow.json"),
				JSON.stringify({ version: "2", items: [] }),
			);
			const drift = inspectWorkspaceIntegrity(root).drifts.find(
				(entry) => entry.code === "WORKSPACE_PROJECTION_DRIFT",
			);
			expect(drift).toMatchObject({
				class: "projection",
				paths: [join(root, ".letra", "workflow.json"), join(data, "workflow.json")],
			});
			expect(drift?.leftHash).toMatch(/^[a-f0-9]{64}$/);
			expect(drift?.rightHash).toMatch(/^[a-f0-9]{64}$/);
			expect(drift?.recovery).toContain("--dry-run");
		} finally {
			rmSync(root, { recursive: true, force: true });
			rmSync(data, { recursive: true, force: true });
		}
	});
});
