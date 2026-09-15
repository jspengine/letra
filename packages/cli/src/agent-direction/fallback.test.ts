import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveFallbackDirection } from "./fallback.js";
import { resolveAgentDirection } from "./service.js";
import * as sessionLog from "../session-log.js";

const roots: string[] = [];

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-direction-fallback-"));
	roots.push(root);
	mkdirSync(join(root, ".letra", "specs", "fallback"), { recursive: true });
	writeFileSync(
		join(root, ".letra", "workflow.json"),
		JSON.stringify(
			{
				version: "1.0",
				name: "Fallback fixture",
				createdAt: "2026-07-05T00:00:00.000Z",
				updatedAt: "2026-07-05T00:00:00.000Z",
				stages: [{ id: "code", name: "Code", order: 0, zone: "doing" }],
				items: [
					{
						id: "ITEM-1",
						description: "Fallback direction",
						stage: "code",
						spec: "fallback",
						createdAt: "2026-07-05T00:00:00.000Z",
					},
				],
				primaryItemId: "ITEM-1",
				tools: ["codex"],
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(root, ".letra", "specs", "fallback", "spec.md"),
		"# Spec\n\n## Acceptance Criteria\n- [ ] **AC1**: fallback remains safe\n",
	);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("direction fallback", () => {
	it("preserves canonical direction while declaring live context unavailable", () => {
		const root = fixture();
		const canonical = resolveAgentDirection(root);
		const fallback = resolveFallbackDirection(root);

		expect(fallback).toMatchObject({
			mode: "degraded",
			revision: canonical.revision,
			item: canonical.item,
			pendingAC: canonical.pendingAC,
			warnings: expect.arrayContaining([
				{
					code: "LIVE_CONTEXT_UNAVAILABLE",
					message: expect.stringContaining("letra direction --json"),
				},
			]),
		});
		expect(canonical.warnings).not.toContainEqual(
			expect.objectContaining({
				code: "LIVE_CONTEXT_UNAVAILABLE",
			}),
		);
	});

	it("does not duplicate the fallback warning when canonical state is already degraded", () => {
		const fallback = resolveFallbackDirection(fixture());
		expect(
			fallback.warnings.filter((warning) => warning.code === "LIVE_CONTEXT_UNAVAILABLE"),
		).toHaveLength(1);
	});

	it("retries audit on a later read after a sink failure", () => {
		const root = fixture();
		const audit = vi.spyOn(sessionLog, "logEntry")
			.mockImplementationOnce(() => { throw new Error("sink unavailable"); })
			.mockImplementation(() => ({ id: "log-test", timestamp: "", action: "", description: "", itemId: null, acId: null, details: {} }));
		const first = resolveFallbackDirection(root);
		const second = resolveFallbackDirection(root);
		expect(first.warnings.some((warning) => warning.code === "AUDIT_DEGRADED")).toBe(true);
		expect(second.warnings.some((warning) => warning.code === "AUDIT_DEGRADED")).toBe(false);
		expect(audit).toHaveBeenCalledTimes(2);
	});
});
