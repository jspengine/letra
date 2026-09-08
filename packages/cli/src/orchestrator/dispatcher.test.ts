import { describe, expect, it, vi } from "vitest";
import { PersistentDispatcher } from "./dispatcher.js";
import { createSimulatedExecutor } from "./simulated-executor.js";

describe("PersistentDispatcher", () => {
	it("dispatches pending handoff and skips offline executors", async () => {
		const execute = vi.fn().mockResolvedValue({ success: true, output: "ok", artifacts: [], evidences: [] });
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "a", to: "b", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, writeWorkflow: vi.fn(), advance: vi.fn() };
		const result = await new PersistentDispatcher(store, () => [{ id: "offline", label: "", capabilities: [], status: "offline", execute }, { id: "online", label: "", capabilities: [], status: "online", execute }]).dispatch();
		expect(result[0].status).toBe("dispatched"); expect(execute).toHaveBeenCalled(); expect(store.writeWorkflow).toHaveBeenCalled();
	});

	it("records simulated evidence and the next handoff", async () => {
		const workflow = {
			items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }],
			stages: [
				{ id: "code", name: "Code", order: 1, agents: ["implementer"] },
				{ id: "review", name: "Review", order: 2, agents: ["reviewer"] },
			], name: "", version: "1", createdAt: "", updatedAt: "", tools: [],
		} as any;
		const store = { loadWorkflow: () => workflow, writeWorkflow: vi.fn((next) => Object.assign(workflow, next)), advance: vi.fn() };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated", ["code"])], 30_000).dispatch();
		expect(result[0].status).toBe("dispatched");
		expect(workflow.items[0].activityStatus).toBe("succeeded");
		expect(workflow.items[0].stage).toBe("review");
		expect(workflow.items[0].handoff?.to).toBe("reviewer");
		expect(workflow.items[0].handoff?.evidence).toContain("simulated:code:I");
	});

	it("pauses a handoff addressed to the human", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "security", createdAt: "", handoff: { from: "security", to: "human", summary: "Approve", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "security", name: "Security", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, writeWorkflow: vi.fn(), advance: vi.fn() };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated")]).dispatch();
		expect(result).toEqual([{ itemId: "I", status: "waiting-human", reason: "aguardando decisão humana" }]);
		expect(store.writeWorkflow).not.toHaveBeenCalled();
	});

	it("lets the current stage owner execute before presenting its human gate", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "security", createdAt: "", handoff: { from: "reviewer", to: "security", summary: "Scan", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "security", name: "Security", order: 1, agents: ["security"], gate: "human-approved" }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, writeWorkflow: vi.fn((next) => Object.assign(workflow, next)), advance: vi.fn() };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated", ["security"])], 30_000, { blocksHandoff: (stage, item) => stage.gate === "human-approved" && item.handoff?.to !== (stage as typeof stage & { agents?: string[] }).agents?.[0] }).dispatch();
		expect(result[0].status).toBe("dispatched");
		expect(workflow.items[0].handoff?.to).toBe("human");
	});

	it("uses the durable claim operation when a store provides CAS", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const claim = vi.fn().mockResolvedValue(false);
		const store = { loadWorkflow: () => workflow, writeWorkflow: vi.fn(), advance: vi.fn(), claim };
		const result = await new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated")]).dispatch();
		expect(result).toEqual([]);
		expect(claim).toHaveBeenCalledWith("I", "simulated", "implementer");
		expect(store.writeWorkflow).not.toHaveBeenCalled();
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
		const store = { loadWorkflow: () => workflow, writeWorkflow: vi.fn((next) => Object.assign(workflow, next)), advance: vi.fn() };
		const dispatcher = new PersistentDispatcher(store, () => [createSimulatedExecutor("simulated")]);
		await dispatcher.dispatch();
		await dispatcher.dispatch();
		await dispatcher.dispatch();
		expect(workflow.items[0].stage).toBe("security");
		expect(workflow.items[0].handoff?.to).toBe("human");
		expect(workflow.items[0].lastHeartbeatAt).toEqual(expect.any(String));
	});

	it("releases a claim when an executor throws", async () => {
		const workflow = { items: [{ id: "I", description: "", stage: "code", createdAt: "", handoff: { from: "design", to: "implementer", summary: "", evidence: [], timestamp: "", expiresAt: "" } }], stages: [{ id: "code", name: "Code", order: 1 }], name: "", version: "1", createdAt: "", updatedAt: "", tools: [] } as any;
		const store = { loadWorkflow: () => workflow, writeWorkflow: vi.fn((next) => Object.assign(workflow, next)), advance: vi.fn() };
		const failing = { id: "simulated", label: "", capabilities: ["code"], status: "online" as const, execute: vi.fn().mockRejectedValue(new Error("boom")) };
		const result = await new PersistentDispatcher(store, () => [failing]).dispatch();
		expect(result[0].status).toBe("failed");
		expect(workflow.items[0].claimedBy).toBeUndefined();
		expect(workflow.items[0].activityStatus).toBe("failed");
		expect(workflow.items[0].lastFailure?.recovery).toBe("retry");
	});
});
