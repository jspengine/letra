import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { activateWorkOperation, claimOperation, submitEvidenceOperation, type OperationResult } from "./service.js";

// Spec recusas-que-ensinam: every refusal names its real cause and the next
// command; steps that belong to a human are flagged instead of handed to the agent.

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

interface FixtureOptions {
	/** Write the harness the workflow template points to. */
	harness?: boolean;
	/** Give the Design stage a role. */
	designRole?: boolean;
	itemStage?: string;
}

function activationFixture({ harness = true, designRole = true, itemStage = "backlog" }: FixtureOptions = {}): string {
	const root = mkdtempSync(join(tmpdir(), "letra-refusal-guidance-"));
	roots.push(root);
	mkdirSync(join(root, ".letra", "identity"), { recursive: true });
	writeFileSync(join(root, ".letra", "identity", "local.json"), JSON.stringify({ id: "human:owner", osUser: "owner", hostname: "test-host", createdAt: new Date().toISOString() }));
	writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify({
		version: "1.0", name: "Refusals", createdAt: "2026-11-24T00:00:00.000Z", updatedAt: "2026-11-24T00:00:00.000Z",
		template: "controlled-flow", harnessVersion: "v0.2.0",
		stages: [{ id: "backlog", name: "Backlog", order: 0, zone: "todo" }, { id: "design", name: "Design", order: 1, zone: "doing" }],
		items: [{ id: "ITEM-1", description: "Refusal subject", stage: itemStage, createdAt: "2026-11-24T00:00:00.000Z" }],
		tools: [],
	}, null, 2));
	if (harness) {
		const dir = join(root, ".letra", "harness", "v0.2.0");
		mkdirSync(join(dir, "flows"), { recursive: true });
		mkdirSync(join(dir, "roles"), { recursive: true });
		mkdirSync(join(dir, "gates"), { recursive: true });
		const designAgents = designRole ? "\n      - analyst" : " []";
		writeFileSync(join(dir, "flows", "controlled-flow.yaml"), `id: controlled-flow\nversion: 1\nname: Controlled\ndescription: test\ndefaultPolicy: default\nstages:\n  - id: backlog\n    name: Backlog\n    order: 0\n    description: queued\n    agents: []\n    gate: null\n  - id: design\n    name: Design\n    order: 1\n    description: define\n    agents:${designAgents}\n    gate: null\n`);
		writeFileSync(join(dir, "roles", "analyst.yaml"), "id: analyst\nlabel: Analyst\ndescription: test\nallowedStages:\n  - design\ncapabilities:\n  - write_spec\n");
	}
	return root;
}

/** Follows the canonical path an agent takes: the stale refusal carries the revision to retry with. */
async function activate(root: string, itemId = "ITEM-1"): Promise<OperationResult> {
	const input = { itemId, actor: "human:owner", reason: "Prioridade confirmada." };
	const probe = await activateWorkOperation(root, { ...input, expectedRevision: "sha256:unknown" });
	expect(probe.reasonCode).toBe("DIRECTION_STALE");
	return activateWorkOperation(root, { ...input, expectedRevision: probe.beforeRevision });
}

describe("AC1 — activation names the real cause", () => {
	it("still activates a backlog item when the flow loads", async () => {
		expect(await activate(activationFixture())).toMatchObject({ outcome: "accepted", reasonCode: "WORK_ACTIVATED" });
	});

	it("reports an unloaded harness as FLOW_NOT_LOADED instead of a backlog rule", async () => {
		const result = await activate(activationFixture({ harness: false }));
		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "FLOW_NOT_LOADED", nextCommand: "letra doctor", humanRequired: true });
		expect(result.reason).toContain("v0.2.0");
	});

	it("reports a missing item as ITEM_NOT_FOUND without blaming the flow", async () => {
		const result = await activate(activationFixture(), "ITEM-404");
		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "ITEM_NOT_FOUND", nextCommand: "letra flow backlog list", humanRequired: true });
		expect(result.reason).toContain("ITEM-404");
	});

	it("names the current stage of an item that is already active", async () => {
		const result = await activate(activationFixture({ itemStage: "design" }));
		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "ACTIVATION_NOT_ALLOWED", nextCommand: "letra direction --item ITEM-1 --json" });
		expect(result.reason).toContain('"design"');
	});

	it("reports a loaded flow without any staffed stage as NO_INITIAL_STAGE", async () => {
		const result = await activate(activationFixture({ designRole: false }));
		expect(result).toMatchObject({ outcome: "rejected", reasonCode: "NO_INITIAL_STAGE", humanRequired: true });
	});
});

function setHandoff(root: string, handoff: Record<string, unknown>): void {
	const path = join(root, ".letra", "workflow.json");
	const workflow = JSON.parse(readFileSync(path, "utf8"));
	workflow.items[0].handoff = handoff;
	writeFileSync(path, JSON.stringify(workflow, null, 2));
}

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

async function claim(root: string, actor: string, capability: string, expectedRevision?: string): Promise<OperationResult> {
	const input = { itemId: "ITEM-1", executorId: "codex", reason: "Assume o item", actor, capability };
	if (expectedRevision) return claimOperation(root, { ...input, expectedRevision });
	const probe = await claimOperation(root, { ...input, expectedRevision: "sha256:unknown" });
	expect(probe.reasonCode).toBe("DIRECTION_STALE");
	return claimOperation(root, { ...input, expectedRevision: probe.beforeRevision });
}

/** Reads one `--flag value` from a suggested command. */
function flag(command: string | undefined, name: string): string {
	const match = command?.match(new RegExp(`--${name} (\\S+)`));
	expect(match, `${name} in ${command}`).toBeTruthy();
	return match?.[1] ?? "";
}

/** AC8: running the suggested claim is not refused for the same cause. */
async function followSuggestedClaim(root: string, refusal: OperationResult): Promise<OperationResult> {
	expect(refusal.nextCommand).toMatch(/^letra operation claim ITEM-1 /);
	expect(flag(refusal.nextCommand, "expected-revision")).toBe(refusal.afterRevision);
	return claim(root, flag(refusal.nextCommand, "actor"), flag(refusal.nextCommand, "capability"), flag(refusal.nextCommand, "expected-revision"));
}

describe("AC2 — claim names the accepted actor", () => {
	it("lists the stage roles and suggests the claim that is accepted", async () => {
		const root = activationFixture({ itemStage: "design" });
		const refusal = await claim(root, "designer", "write_spec");
		expect(refusal).toMatchObject({ outcome: "rejected", reasonCode: "ACTOR_NOT_ALLOWED", humanRequired: false });
		expect(refusal.reason).toContain("analyst");
		expect(await followSuggestedClaim(root, refusal)).toMatchObject({ outcome: "accepted" });
	});

	it("points to the recipient of an active handoff", async () => {
		const root = activationFixture({ itemStage: "design" });
		setHandoff(root, { from: "human:owner", to: "analyst", summary: "start", evidence: [], timestamp: minutesFromNow(0), expiresAt: minutesFromNow(30) });
		const refusal = await claim(root, "reviewer", "write_spec");
		expect(refusal).toMatchObject({ reasonCode: "ACTOR_NOT_ALLOWED" });
		expect(refusal.reason).toContain("--actor analyst");
		expect(await followSuggestedClaim(root, refusal)).toMatchObject({ outcome: "accepted" });
	});
});

describe("AC3 — claim names the accepted capability", () => {
	it("explains the role vocabulary when an executor capability is sent", async () => {
		const root = activationFixture({ itemStage: "design" });
		const refusal = await claim(root, "analyst", "design");
		expect(refusal).toMatchObject({ outcome: "rejected", reasonCode: "CAPABILITY_INVALID" });
		expect(refusal.reason).toContain("write_spec");
		expect(refusal.reason).toContain("registro de executores");
		expect(flag(refusal.nextCommand, "capability")).toBe("write_spec");
		expect(await followSuggestedClaim(root, refusal)).toMatchObject({ outcome: "accepted" });
	});
});

describe("AC4 — expired handoff says how to recover and who acts", () => {
	it("suggests the rollback and leaves re-issuing to the agent sender", async () => {
		const root = activationFixture({ itemStage: "design" });
		setHandoff(root, { from: "reviewer", to: "analyst", summary: "start", evidence: [], timestamp: minutesFromNow(-60), expiresAt: minutesFromNow(-30) });
		const refusal = await claim(root, "analyst", "write_spec");
		expect(refusal).toMatchObject({ reasonCode: "HANDOFF_EXPIRED", nextCommand: "letra flow handoff ITEM-1 --rollback", humanRequired: false });
		expect(refusal.reason).toContain("reviewer reemite");
	});

	it("flags a human sender: the agent must not re-issue a human handoff", async () => {
		const root = activationFixture({ itemStage: "design" });
		setHandoff(root, { from: "human:owner", to: "analyst", summary: "start", evidence: [], timestamp: minutesFromNow(-60), expiresAt: minutesFromNow(-30) });
		const refusal = await claim(root, "analyst", "write_spec");
		expect(refusal).toMatchObject({ reasonCode: "HANDOFF_EXPIRED", humanRequired: true });
	});
});

describe("AC4 — every refusal carries the next command", () => {
	it("DIRECTION_STALE points to the direction the operation compares", async () => {
		const root = activationFixture({ itemStage: "design" });
		const refusal = await claimOperation(root, { itemId: "ITEM-1", executorId: "codex", reason: "x", actor: "analyst", capability: "write_spec", expectedRevision: "sha256:unknown" });
		expect(refusal).toMatchObject({ reasonCode: "DIRECTION_STALE", nextCommand: "letra direction --item ITEM-1 --json", humanRequired: false });
	});

	it("CLAIM_REQUIRED suggests the claim of the stage role, and following it is accepted", async () => {
		const root = activationFixture({ itemStage: "design" });
		const input = { itemId: "ITEM-1", executorId: "codex", reason: "Evidencia", actor: "analyst", evidence: [{ kind: "command" as const, value: "npm test", source: "local" }] };
		const probe = await submitEvidenceOperation(root, { ...input, expectedRevision: "sha256:unknown" });
		const refusal = await submitEvidenceOperation(root, { ...input, expectedRevision: probe.beforeRevision });
		expect(refusal).toMatchObject({ outcome: "rejected", reasonCode: "CLAIM_REQUIRED", humanRequired: false });
		expect(flag(refusal.nextCommand, "actor")).toBe("analyst");
		expect(flag(refusal.nextCommand, "capability")).toBe("write_spec");
		expect(await followSuggestedClaim(root, refusal)).toMatchObject({ outcome: "accepted" });
	});
});
