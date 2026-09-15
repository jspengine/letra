import { describe, expect, it, vi } from "vitest";
import { PersistentDispatcher, type DispatcherOperations } from "./dispatcher.js";
import { createSimulatedExecutor } from "./simulated-executor.js";

function canonicalOperations(workflow: any) {
	const direction = () => ({ revision: "test-revision", item: workflow.items[0] ?? null } as any);
	const accepted = () => ({ outcome: "accepted" as const, afterRevision: "test-revision", reasonCode: "OK", reason: "ok", nextDirection: direction() });
	return {
		getDirection: direction,
		claim: vi.fn(async ({ itemId, executorId, actor, capability }: any) => { const item = workflow.items.find((entry: any) => entry.id === itemId); Object.assign(item, { claimedBy: actor, claimExecutorId: executorId, claimCapability: capability, claimedAt: new Date().toISOString(), claimExpiresAt: new Date(Date.now() + 60_000).toISOString() }); return accepted(); }),
		event: vi.fn(async ({ itemId, status, message, errorCode }: any) => { const item = workflow.items.find((entry: any) => entry.id === itemId); item.activityStatus = status; item.lastHeartbeatAt = new Date().toISOString(); if (status === "failed") { item.claimedBy = undefined; item.claimExecutorId = undefined; item.lastFailure = { code: errorCode, message, recovery: "retry", at: new Date().toISOString() }; } return accepted(); }),
		evidence: vi.fn(async () => accepted()),
		validate: vi.fn(async () => accepted()),
		transition: vi.fn(async ({ itemId, targetStageId }: any) => { workflow.items.find((entry: any) => entry.id === itemId).stage = targetStageId; return accepted(); }),
		handoff: vi.fn(async ({ itemId, to, summary, evidence, executorId }: any) => { const item = workflow.items.find((entry: any) => entry.id === itemId); Object.assign(item, { claimedBy: undefined, claimExecutorId: undefined, activityStatus: "succeeded", handoff: { from: "agent", to, summary, evidence, executorId, timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 1_800_000).toISOString() } }); return accepted(); }),
		release: vi.fn(async ({ itemId }: any) => { const item = workflow.items.find((entry: any) => entry.id === itemId); Object.assign(item, { claimedBy: undefined, claimExecutorId: undefined }); return accepted(); }),
	} satisfies DispatcherOperations;
}

describe("PersistentDispatcher", () => {
	it("dispatches pending handoff and skips offline executors", async () => {
		const execute = vi.fn().mockResolvedValue({ success: true, output: "ok", artifacts: [], evidences: [] });
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "a", to: "b", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const result = await new PersistentDispatcher(store, () => [{ id: "offline", label: "", capabilities: [], status: "offline", execute }, { id: "online", label: "", capabilities: ["code"], status: "online", execute }]).dispatch();
		expect(result[0].status).toBe("dispatched"); expect(execute).toHaveBeenCalled(); expect(store.operations.claim).toHaveBeenCalled();
	});

	it("records simulated evidence and the next handoff", async () => {
		const workflow = {
			items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }],
			stages: [
				{ id: "code", name: "Code", order: 1, agents: ["implementer"] },
				{ id: "review", name: "Review", order: 2, agents: ["reviewer"] },
			], name: "", version: "1", createdAt: "", updatedAt: "", tools: [],
		} as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated", ["code"])], 30_000).dispatch();
		expect(result[0].status).toBe("dispatched");
		expect(workflow.items[0].activityStatus).toBe("succeeded");
		expect(workflow.items[0].stage).toBe("review");
		expect(workflow.items[0].handoff?.to).toBe("reviewer");
		expect(workflow.items[0].handoff?.evidence).toContain("simulated:code:I");
	});

	it("pauses a handoff addressed to the human", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "security", createdAt: "", handoff: { from: "security", to: "human", summary: "Approve", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "security", name: "Security", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated")], 30_000, { blocksHandoff: () => true }).dispatch();
		expect(result).toEqual([{ itemId: "I", status: "waiting-human", reason: "gate humano bloqueante" }]);
		expect(store.operations.claim).not.toHaveBeenCalled();
	});

	it("rejects a human handoff when no blocking human gate is configured", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "review", createdAt: "", handoff: { from: "reviewer", to: "human", summary: "Approve", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "review", name: "Review", order: 1, gate: null }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated")]).dispatch();
		expect(result).toEqual([{ itemId: "I", status: "failed", reason: expect.stringContaining("HUMAN_HANDOFF_REQUIRES_BLOCKING_GATE") }]);
		expect(store.operations.claim).not.toHaveBeenCalled();
	});

	it("lets the current stage owner execute before presenting its human gate", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "security", createdAt: "", handoff: { from: "reviewer", to: "security", summary: "Scan", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "security", name: "Security", order: 1, agents: ["security"], gate: "human-approved" }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated", ["security"])], 30_000, { blocksHandoff: (stage, item) => stage.gate === "human-approved" && item.handoff?.to !== (stage as typeof stage & { agents?: string[] }).agents?.[0] }).dispatch();
		expect(result[0].status).toBe("dispatched");
		expect(workflow.items[0].handoff?.to).toBe("human");
	});

	it("uses the durable claim operation when a store provides CAS", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: { ...canonicalOperations(workflow), claim: vi.fn(async () => ({ outcome: "rejected" as const, afterRevision: "test-revision", reasonCode: "CLAIM_CONFLICT", reason: "busy", nextDirection: { revision: "test-revision", item: workflow.items[0] } as any })) } };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated")]).dispatch();
		expect(result).toEqual([{ itemId: "I", status: "failed", reason: "busy" }]);
		expect(store.operations.claim).toHaveBeenCalledWith(expect.objectContaining({ itemId: "I", executorId: "simulated", actor: "implementer" }));
	});

	it("walks code, review and security until the final human handoff", async () => {
		const workflow = {
			items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "human", to: "implementer", summary: "Approved", evidence: [], timestamp: "", expiresAt: "" } }],
			stages: [
				{ id: "code", name: "Code", order: 1, agents: ["implementer"] },
				{ id: "review", name: "Review", order: 2, agents: ["reviewer"] },
				{ id: "security", name: "Security", order: 3, agents: ["security"], gate: "human-approved" },
			], name: "", version: "1", createdAt: "", updatedAt: "", tools: [],
		} as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const dispatcher = new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated")], 30_000, { blocksHandoff: (stage, item) => stage.gate === "human-approved" && item.handoff?.to !== (stage as typeof stage & { agents?: string[] }).agents?.[0] });
		await dispatcher.dispatch();
		await dispatcher.dispatch();
		await dispatcher.dispatch();
		expect(workflow.items[0].stage).toBe("security");
		expect(workflow.items[0].handoff?.to).toBe("human");
		expect(workflow.items[0].lastHeartbeatAt).toEqual(expect.any(String));
	});

	it("carries the configured team through design, code, review and security before the human gate", async () => {
		const workflow = {
			items: [{ id: "I", description: "", stage: "design", createdAt: "", handoff: { from: "human:owner", to: "analyst", summary: "Activated", evidence: ["activation:human-approved"], timestamp: "", expiresAt: "" } }],
			stages: [
				{ id: "design", name: "Design", order: 1, agents: ["analyst"] },
				{ id: "code", name: "Code", order: 2, agents: ["implementer"] },
				{ id: "review", name: "Review", order: 3, agents: ["reviewer"] },
				{ id: "security", name: "Security", order: 4, agents: ["security"], gate: "human-approved" },
			], name: "", version: "1", createdAt: "", updatedAt: "", tools: [],
		} as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const codex = createSimulatedExecutor("codex", ["write_spec", "write_code", "review_code", "security_scan"]);
		const persona = { analyst: "Ada Lovelace", implementer: "Alan Turing", reviewer: "Katherine Johnson", security: "Marie Curie" } as const;
		const capability = { design: "write_spec", code: "write_code", review: "review_code", security: "security_scan" } as const;
		const dispatcher = new PersistentDispatcher(store, () => [codex], 30_000, {
			stageActors: (stageId) => workflow.stages.find((stage: any) => stage.id === stageId)?.agents ?? [],
			stageCapability: (stage) => capability[stage.id as keyof typeof capability],
			resolveBinding: (stage, _item, actor, required, executors) => ({ ok: true, binding: { version: "1", id: `${actor}:${executors[0].id}`, identityId: actor, roleId: actor, executorId: executors[0].id, capabilities: [required], stageIds: [stage.id], availability: "online-required", harnessVersion: "v0.2.0" }, identity: { id: actor, displayName: persona[actor as keyof typeof persona], role: actor, avatar: { type: "initials", value: actor.slice(0, 2) }, color: "blue", skills: [], status: "online", stageBindings: [stage.id] }, executor: executors[0] }),
			blocksHandoff: (stage, item) => stage.gate === "human-approved" && item.handoff?.to !== "security",
		});
		await dispatcher.dispatch(); await dispatcher.dispatch(); await dispatcher.dispatch(); await dispatcher.dispatch();
		expect(workflow.items[0]).toMatchObject({ stage: "security", activityStatus: "succeeded", handoff: { to: "human" } });
		expect(workflow.items[0].lastHeartbeatAt).toEqual(expect.any(String));
		expect(store.operations.claim).toHaveBeenCalledTimes(4);
	});

	it("releases a claim when an executor throws", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const failing = { id: "simulated", label: "", capabilities: ["code"], status: "online" as const, execute: vi.fn().mockRejectedValue(new Error("boom")) };
		const result = await new PersistentDispatcher(store, () => [failing]).dispatch();
		expect(result[0].status).toBe("failed");
		expect(workflow.items[0].claimedBy).toBeUndefined();
		expect(workflow.items[0].activityStatus).toBe("failed");
		expect(workflow.items[0].lastFailure?.recovery).toBe("retry");
	});

	it("does not claim work when the canonical execution workspace is unavailable", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const executor = createSimulatedExecutor("codex", ["code"]);
		const result = await new PersistentDispatcher(store, () => [executor], 30_000, {
			resolveExecutionWorkspace: () => ({ ok: false, reasonCode: "EXECUTION_WORKSPACE_UNTRUSTED", reason: "Git recusou o diretório de dados." }),
		}).dispatch();
		expect(result).toEqual([{ itemId: "I", status: "failed", reason: expect.stringContaining("EXECUTION_WORKSPACE_UNTRUSTED") }]);
		expect(store.operations.claim).not.toHaveBeenCalled();
	});

	it("releases a claim after a process failure so the item is not falsely busy", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const failedProcess = { id: "codex", label: "Codex", capabilities: ["code"], status: "online" as const, execute: vi.fn().mockResolvedValue({ success: false, output: "", artifacts: [], evidences: [], error: "process exited 1" }) };
		const result = await new PersistentDispatcher(store, () => [failedProcess]).dispatch();
		expect(result[0]).toMatchObject({ status: "failed", reason: "process exited 1" });
		expect(store.operations.release).toHaveBeenCalledWith(expect.objectContaining({ itemId: "I", actor: "implementer" }));
		expect(workflow.items[0].claimedBy).toBeUndefined();
	});

	it("preserves the canonical Security rejection envelope in dispatcher failures", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "security", createdAt: "", handoff: { from: "reviewer", to: "security", summary: "Scan", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "security", name: "Security", order: 1, agents: ["security"] }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const securityReview = { schemaVersion: "1", decision: "blocked", reasonCode: "SECURITY_SCOPED_BLOCKED", blockingFindings: [{ id: "npm:unsafe" }], findings: [], globalFindings: [], scannerEvidence: [], context: {}, generatedAt: "", expiresAt: "", workspaceFingerprint: "", scopeFingerprint: "", reportFingerprint: "sealed" } as any;
		const store = { loadWorkflow: () => workflow, operations: { ...canonicalOperations(workflow), securityReview: vi.fn(async () => ({ outcome: "rejected" as const, afterRevision: "security-revision", reasonCode: "SECURITY_SCOPED_BLOCKED", reason: "achado bloqueante", nextDirection: { revision: "security-revision", item: workflow.items[0] } as any, securityReview })) } };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated", ["security"])], 30_000).dispatch();
		expect(result[0]).toMatchObject({ status: "failed", outcome: "rejected", reasonCode: "SECURITY_SCOPED_BLOCKED", reason: "achado bloqueante", securityReview });
	});

	it("selects the preferred compatible executor deterministically", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1, agents: ["implementer"] }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const first = createSimulatedExecutor("first", ["write_code"]);
		const preferred = createSimulatedExecutor("preferred", ["write_code"]);
		await new PersistentDispatcher(store, () => [first, preferred], 30_000, { stageCapability: () => "write_code", executorPreference: () => ["preferred", "first"] }).dispatch();
		expect(store.operations.claim).toHaveBeenCalledWith(expect.objectContaining({ executorId: "preferred", capability: "write_code" }));
	});

	it("uses the resolved persona binding instead of a generic compatible executor", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1, agents: ["implementer"] }, { id: "review", name: "Review", order: 2, agents: ["reviewer"] }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, operations: canonicalOperations(workflow) };
		const generic = createSimulatedExecutor("generic", ["write_code"]);
		const bound = createSimulatedExecutor("codex", ["write_code"]);
		const genericExecute = vi.spyOn(generic, "execute");
		const boundExecute = vi.spyOn(bound, "execute");
		await new PersistentDispatcher(store, () => [generic, bound], 30_000, {
			stageCapability: () => "write_code",
			resolveBinding: (_stage, _item, _actor, _capability, executors) => ({ ok: true, binding: { version: "1", id: "alan:implementer:codex", identityId: "alan", roleId: "implementer", executorId: "codex", capabilities: ["write_code"], stageIds: ["code"], availability: "online-required", harnessVersion: "v0.2.0" }, identity: { id: "alan", displayName: "Alan Turing", role: "implementer", avatar: { type: "initials", value: "AT" }, color: "blue", skills: [], status: "online", stageBindings: ["code"] }, executor: executors.find((entry) => entry.id === "codex")! }),
		}).dispatch();
		expect(store.operations.claim).toHaveBeenCalledWith(expect.objectContaining({ executorId: "codex", actor: "implementer" }));
		expect(genericExecute).not.toHaveBeenCalled();
		expect(boundExecute).toHaveBeenCalledWith(expect.objectContaining({ agent: "Alan Turing", promptTemplate: null }));
	});

	it("retries a stale gateway revision before starting and does not strand the claim", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1, agents: ["implementer"] }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		let revision = "initial";
		const direction = () => ({ revision, item: workflow.items[0] } as any);
		const accepted = () => ({ outcome: "accepted" as const, afterRevision: revision, reasonCode: "OK", reason: "ok", nextDirection: direction() });
		const operations = {
			getDirection: direction,
			claim: vi.fn(async () => { Object.assign(workflow.items[0], { claimedBy: "implementer", claimExecutorId: "simulated" }); revision = "claimed"; return accepted(); }),
			event: vi.fn(async ({ status, expectedRevision }: any) => {
				if (status === "started" && expectedRevision === "claimed") { revision = "changed-by-watcher"; return { outcome: "rejected" as const, afterRevision: revision, reasonCode: "DIRECTION_STALE", reason: "stale", nextDirection: direction() }; }
				workflow.items[0].activityStatus = status; return accepted();
			}),
			evidence: vi.fn(async () => accepted()), validate: vi.fn(async () => accepted()),
			transition: vi.fn(async () => accepted()), handoff: vi.fn(async () => accepted()), release: vi.fn(async () => accepted()),
		} satisfies DispatcherOperations;
		const executor = createSimulatedExecutor("simulated", ["code"]);
		const result = await new PersistentDispatcher({ loadWorkflow: () => workflow, operations }, () => [executor]).dispatch();
		expect(result[0].status).toBe("dispatched");
		expect(operations.event).toHaveBeenCalledTimes(3);
		expect(operations.release).not.toHaveBeenCalled();
	});
});
