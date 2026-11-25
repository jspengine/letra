import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RunEntity } from "@letra/types";
import { createExecutionRun, readExecutionRuns, updateExecutionRun } from "./store.js";
import { resolveDirection } from "../agent-direction/service.js";

const roots: string[] = [];

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-runs-"));
	roots.push(root);
	mkdirSync(join(root, ".letra"), { recursive: true });
	return root;
}

function runEntity(): RunEntity {
	const now = new Date().toISOString();
	return {
		id: "run-123",
		workspaceId: "workspace-1",
		itemId: "ITEM-98",
		binding: { actorId: "agent:turing:codex", identityId: "turing", roleId: "implementer", executorId: "codex" },
		authorization: { kind: "claim", actorId: "agent:turing:codex", referenceId: "claim-1", grantedAt: now, revision: "sha256:claim" },
		workflowVersionId: "flow-main@1",
		cycle: { number: 1, startedAt: now, endedAt: null },
		lease: { expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), heartbeatAt: now, ttlMinutes: 30 },
		revision: 1,
		directionRevision: "sha256:direction",
		createdAt: now,
		updatedAt: now,
		result: null,
		handoffs: [],
		gateDecisions: [],
		evidence: [],
		status: "running",
	};
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("canonical execution run store", () => {
	it("returns unassigned or selection-required instead of choosing an arbitrary run", () => {
		const root = fixture();
		expect(resolveDirection(root)).toMatchObject({ assignment: { status: "unassigned" }, item: null });
		const first = runEntity();
		const second = { ...runEntity(), id: "run-456", itemId: "ITEM-99" };
		createExecutionRun(root, first);
		createExecutionRun(root, second);
		expect(resolveDirection(root)).toMatchObject({
			assignment: { status: "selection-required", candidateRunIds: ["run-123", "run-456"] },
			item: null,
		});
	});

	it("persists the complete Run identity, authorization, pinned workflow, cycle, lease, revision and result", () => {
		const root = fixture();
		const run = runEntity();

		const store = createExecutionRun(root, run);

		expect(store).toMatchObject({ schemaVersion: 1, runs: [run] });
		expect(readExecutionRuns(root)).toEqual(store);
		expect(JSON.parse(readFileSync(join(root, ".letra", "runtime", "runs.json"), "utf8")).runs[0]).toMatchObject({
			workspaceId: "workspace-1",
			itemId: "ITEM-98",
			workflowVersionId: "flow-main@1",
			authorization: { kind: "claim", referenceId: "claim-1" },
			cycle: { number: 1 },
			lease: { ttlMinutes: 30, heartbeatAt: run.lease?.heartbeatAt },
			directionRevision: "sha256:direction",
			result: null,
		});
	});

	it("rejects duplicate run IDs and malformed revision or lease data", () => {
		const root = fixture();
		const run = runEntity();
		createExecutionRun(root, run);

		expect(() => createExecutionRun(root, run)).toThrow("RUN_ALREADY_EXISTS");
		expect(() => createExecutionRun(root, { ...run, id: "run-124", revision: 0 })).toThrow("revision and cycle number");
		expect(() => createExecutionRun(root, { ...run, id: "run-125", lease: { ...run.lease!, ttlMinutes: 0 } })).toThrow("lease expiry, heartbeat and TTL");
		expect(readExecutionRuns(root).runs).toHaveLength(1);
	});

	it("rejects a concurrent writer instead of replacing the shared run store", () => {
		const root = fixture();
		const existing = runEntity();
		createExecutionRun(root, existing);
		const storePath = join(root, ".letra", "runtime", "runs.json");
		const before = readFileSync(storePath, "utf8");
		writeFileSync(`${storePath}.lock`, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));

		expect(() => createExecutionRun(root, { ...existing, id: "run-parallel" })).toThrow("RUN_STORE_BUSY");
		expect(readFileSync(storePath, "utf8")).toBe(before);
		expect(readExecutionRuns(root).runs.map((entry) => entry.id)).toEqual([existing.id]);
	});

	it("updates one Run with compare-and-swap revision semantics", () => {
		const root = fixture();
		createExecutionRun(root, runEntity());
		const updated = updateExecutionRun(root, "run-123", 1, (run) => ({ ...run, workflowVersionId: "flow-main@2", revision: run.revision + 1, updatedAt: new Date().toISOString() }));
		expect(updated).toMatchObject({ revision: 2, workflowVersionId: "flow-main@2" });
		expect(() => updateExecutionRun(root, "run-123", 1, (run) => ({ ...run, revision: run.revision + 1 }))).toThrow("RUN_REVISION_CONFLICT:2");
		expect(readExecutionRuns(root).runs[0]).toMatchObject({ revision: 2, workflowVersionId: "flow-main@2" });
	});
});
