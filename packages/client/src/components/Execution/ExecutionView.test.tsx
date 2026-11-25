import type { RunEntity, Workflow } from "@letra/types";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ExecutionView from "./ExecutionView";

const workflow: Workflow = { version: "1", name: "Test", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z", stages: [], items: [{ id: "ITEM-7", description: "supervised", stage: "review", createdAt: "2026-10-01T00:00:00.000Z", handoff: { from: "implementer", to: "reviewer", summary: "Code complete; review next", evidence: ["vitest:49-passed"], timestamp: "2026-10-01T00:20:00.000Z", expiresAt: "2026-10-01T01:00:00.000Z" } } as any], tools: [] };
const run: RunEntity = {
	id: "RUN-42", workspaceId: "workspace", itemId: "ITEM-7",
	binding: { actorId: "agent:builder", identityId: "builder", roleId: "implementer", executorId: "codex" },
	authorization: { kind: "claim", actorId: "agent:builder", referenceId: "claim-1", grantedAt: "2026-10-01T00:00:00.000Z", revision: "sha256:claim" },
	workflowVersionId: "main@3", workflowStageId: "review", cycle: { number: 2, startedAt: "2026-10-01T00:00:00.000Z", endedAt: null },
	lease: { expiresAt: "2026-10-01T01:00:00.000Z", heartbeatAt: "2026-10-01T00:30:00.000Z", ttlMinutes: 60 },
	revision: 9, directionRevision: "sha256:direction", createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:30:00.000Z",
	result: null, handoffs: [{ itemId: "ITEM-7", fromActorId: "implementer", toActorId: "reviewer", evidenceIds: ["e1"], createdAt: "2026-10-01T00:20:00.000Z", expiresAt: "2026-10-01T01:00:00.000Z", fromStageId: "code", toStageId: "review", transitionId: "code->review", summary: "Code complete; review next" }], gateDecisions: [], evidence: [{ id: "e1", itemId: "ITEM-7", kind: "test", uri: "vitest:49-passed", observedAt: "2026-10-01T00:30:00.000Z" }], status: "waiting-human",
};

afterEach(() => vi.unstubAllGlobals());

describe("ExecutionView", () => {
	it("shows supervision details for each Run independently of workspace attention", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [run] }));
		render(<ExecutionView workflow={workflow} activeFlow={{ id: "main", source: "workflow-template", harnessVersion: "v1", templateVersion: "1", name: "Main", operations: {}, stages: [{ id: "code", name: "Code", order: 0, roleIds: [], roles: [], agents: [], gate: null, transitions: [{ target: "review" }], provenance: "harness" }, { id: "review", name: "Review", order: 1, roleIds: [], roles: [], agents: [], gate: { id: "review-gate", name: "Review Gate", type: "human", blocking: true }, provenance: "harness" }], roles: [], warnings: [] } as any} />);
		expect(screen.getByText(/Atenção do workspace é independente/)).toBeTruthy();
		await waitFor(() => expect(screen.getByText("RUN-42")).toBeTruthy());
		expect(screen.getByText("ITEM-7")).toBeTruthy();
		expect(screen.getAllByText("codex").length).toBeGreaterThan(0);
		expect(screen.getByText("main@3")).toBeTruthy();
		expect(screen.getByText("revisão 9")).toBeTruthy();
		expect(screen.getByText("ciclo 2")).toBeTruthy();
		expect(screen.getByText("Evidências (1)")).toBeTruthy();
		expect(screen.getByText("Concluído/executado por")).toBeTruthy();
		expect(screen.getByText("implementer → reviewer")).toBeTruthy();
		expect(screen.getByText(/Code → Review · code->review/)).toBeTruthy();
		expect(screen.getByText(/Review Gate/)).toBeTruthy();
		expect(screen.getByText(/Próxima ação:/)).toBeTruthy();
		expect(screen.getByText(/vitest:49-passed/)).toBeTruthy();
	});
});
