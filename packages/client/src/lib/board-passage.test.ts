import type { Item, ResolvedFlowDefinition, ResolvedFlowStage } from "@letra/types";
import { describe, expect, it } from "vitest";
import { BOARD_EXECUTOR_ID, boardClaimRequest, stageExitRequiresGateDecision } from "./board-passage";

const reviewer = { id: "reviewer", label: "Reviewer", description: "", allowedStages: ["review"], capabilities: ["read_code", "review_code"] };
const security = { id: "security", label: "Security", description: "", allowedStages: ["security"], capabilities: ["read_code", "security_scan"] };

function stage(overrides: Partial<ResolvedFlowStage> & Pick<ResolvedFlowStage, "id">): ResolvedFlowStage {
	return { name: overrides.id, order: 0, roleIds: [], roles: [], agents: [], gate: null, provenance: "workflow-version", ...overrides };
}

const review = stage({ id: "review", name: "Review", order: 1, roleIds: ["reviewer"], agents: ["reviewer"], roles: [reviewer], transitions: [{ target: "security" }] });
const securityStage = stage({
	id: "security",
	name: "Security",
	order: 2,
	roleIds: ["security"],
	agents: ["security"],
	roles: [security],
	gate: { id: "human-approved", name: "Human Approved", type: "human", blocking: true, description: "" },
	hooks: { on_enter: [{ action: "security_review", auto: true, requiresClaim: true }] },
});

const flow = {
	stages: [review, securityStage],
	roles: [reviewer, security],
	operations: { security_review: { requiredCapability: "security_scan", requiresClaim: true, allowedInStages: ["security"], allowedActors: [] } },
} as unknown as ResolvedFlowDefinition;

function item(overrides: Partial<Item> = {}): Item {
	return { id: "ITEM-3", description: "Review me", stage: "review", createdAt: "2026-11-24T00:00:00.000Z", ...overrides };
}

const now = Date.parse("2026-11-24T12:00:00.000Z");
const handoffToReviewer = {
	from: "developer",
	to: "reviewer",
	summary: "Pronto para revisão",
	evidence: [],
	timestamp: "2026-11-24T11:50:00.000Z",
	expiresAt: "2026-11-24T12:20:00.000Z",
	executorId: "claude-code",
};

describe("stageExitRequiresGateDecision", () => {
	it("lets an item enter a stage guarded by a human gate (ITEM-44)", () => {
		// Review -> Security: the source has no gate, so the move is a passage.
		expect(stageExitRequiresGateDecision(review)).toBe(false);
	});

	it("keeps requiring the gate decision to leave the gated stage", () => {
		expect(stageExitRequiresGateDecision(securityStage)).toBe(true);
	});

	it("does not treat informative or automated gates as human decisions", () => {
		expect(stageExitRequiresGateDecision(stage({ id: "x", gate: { id: "g", name: "G", type: "human", blocking: false, description: "" } }))).toBe(false);
		expect(stageExitRequiresGateDecision(stage({ id: "y", gate: { id: "g", name: "G", type: "automated", blocking: true, description: "" } }))).toBe(false);
		expect(stageExitRequiresGateDecision(undefined)).toBe(false);
	});
});

describe("boardClaimRequest", () => {
	it("claims as the role named by the active handoff, not as the human session", () => {
		expect(boardClaimRequest(item({ handoff: handoffToReviewer }), review, flow, now)).toEqual({
			role: "reviewer",
			capability: "read_code",
			executorId: BOARD_EXECUTOR_ID,
		});
	});

	it("falls back to the single role of the stage when there is no active handoff", () => {
		const expired = { ...handoffToReviewer, to: "someone-else", expiresAt: "2026-11-24T11:55:00.000Z" };
		expect(boardClaimRequest(item({ handoff: expired }), review, flow, now)).toMatchObject({ role: "reviewer" });
	});

	it("uses the capability pinned by automatic claim hooks", () => {
		expect(boardClaimRequest(item({ stage: "security" }), securityStage, flow, now)).toMatchObject({
			role: "security",
			capability: "security_scan",
		});
	});

	it("explains why it cannot choose a role for multi-role stages", () => {
		const shared = stage({ id: "shared", name: "Shared", agents: ["a", "b"], roleIds: ["a", "b"] });
		expect(boardClaimRequest(item({ stage: "shared" }), shared, flow, now).error).toContain("mais de um papel");
	});
});
