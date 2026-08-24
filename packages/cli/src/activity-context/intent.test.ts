import { describe, expect, it } from "vitest";
import type { ActivityContextSources } from "./sources.js";
import { resolveActivityIntent } from "./intent.js";

function sources(overrides: Partial<ActivityContextSources> = {}): ActivityContextSources {
	return {
		workflow: null,
		currentItem: {
			id: "ITEM-1",
			description: "Declarative context",
			stage: "neutral-stage",
			createdAt: "2026-07-02T00:00:00.000Z",
			spec: "architecture-convergence",
		},
		currentPhase: null,
		activeFlowStage: {
			id: "neutral-stage",
			name: "Neutral Stage",
			order: 1,
			zone: "doing",
			roleIds: [],
			roles: [],
			agents: [],
			gate: null,
			provenance: "harness",
			activity: {
				implement: {
					objective: "Stage objective",
					mustNotDo: ["Stage prohibition"],
					nextActions: [{ label: "Stage action", description: "From stage" }],
				},
			},
		},
		activePhaseDef: null,
		activePhaseHarness: null,
		activeReviewExpectation: null,
		activeGateExpectation: null,
		focus: null,
		focusDiverged: false,
		spec: null,
		activeAlerts: [],
		lastActions: [],
		...overrides,
	};
}

describe("resolveActivityIntent", () => {
	it("uses stage hints before compatibility defaults", () => {
		const result = resolveActivityIntent("implement", sources());

		expect(result.objective).toBe("Stage objective");
		expect(result.nextActions).toEqual([{ label: "Stage action", description: "From stage" }]);
		expect(result.provenance).toMatchObject({
			objective: "stage",
			mustNotDo: "stage",
			nextActions: "stage",
		});
		expect(result.warnings).toEqual([
			"ACTIVITY_HINT_COMPATIBILITY_FALLBACK:implement:mustRead",
		]);
	});

	it("lets phase arrays replace stage arrays without implicit merging", () => {
		const result = resolveActivityIntent(
			"implement",
			sources({
				activePhaseHarness: {
					activity: {
						implement: {
							mustNotDo: ["Phase prohibition"],
							nextActions: [],
						},
					},
				},
			}),
		);

		expect(result.objective).toBe("Stage objective");
		expect(result.mustNotDo).toEqual(["Phase prohibition"]);
		expect(result.nextActions).toEqual([]);
		expect(result.provenance.objective).toBe("stage");
		expect(result.provenance.nextActions).toBe("phase");
	});

	it("keeps legacy phase review expectations compatible", () => {
		const result = resolveActivityIntent(
			"review",
			sources({
				activePhaseDef: {
					id: "neutral-review",
					label: "Neutral review",
					description: "Review description",
				},
				activePhaseHarness: {
					review: {
						label: "Legacy review metadata",
						emphasis: "declared evidence",
						signalCode: "legacy-review",
					},
				},
			}),
		);

		expect(result.signal).toEqual({
			code: "legacy-review",
			message: "Review atual: Legacy review metadata.",
		});
		expect(result.nextActions[0]?.description).toContain("declared evidence");
	});
});
