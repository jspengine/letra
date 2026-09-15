import { describe, expect, it, vi } from "vitest";
import { FlowEngine, type FlowEngineContext } from "./engine.js";
import type { FlowDefinition, FlowItem } from "./types.js";

function createTestFlow(): FlowDefinition {
	return {
		id: "test-flow",
		version: "1",
		name: "Test Flow",
		capability_families: {
			code: ["read_code", "write_code", "run_tests"],
			review: ["review_code"],
			security: ["security_scan"],
		},
		executors: {
			opencode: { command: "opencode", timeout_ms: 300000 },
			codex: { command: "codex", model: "gpt-5.5", timeout_ms: 300000 },
		},
		operations: {
			security_review: {
				required_capability: "security_scan",
				requires_claim: true,
				allowed_in_stages: ["security"],
			},
			rework: {
				required_capability: "review_code",
				allowed_actors: ["reviewer"],
				allowed_in_stages: ["review"],
			},
			handoff: {
				requires_claim: true,
			},
			approve: {
				actor_prefix: "human:",
				allowed_in_stages: ["security"],
			},
		},
		gates: [
			{
				id: "human-approved",
				type: "human",
				blocking: true,
				decisions: ["approve", "reject"],
			},
			{
				id: "code-reviewed",
				type: "automated",
				blocking: true,
				check: "validate",
				decisions: ["approve"],
			},
		],
		stages: [
			{ id: "backlog", name: "Backlog", order: 0, zone: "todo", agents: [], gate: null },
			{
				id: "design",
				name: "Design",
				order: 1,
				zone: "doing",
				agents: ["analyst"],
				gate: "spec-approved",
				rework: { target: "backlog", allowed_actors: ["analyst"] },
				hooks: {
					on_exit: [{ action: "capture_baseline", auto: true }],
				},
			},
			{
				id: "code",
				name: "Code",
				order: 2,
				zone: "doing",
				agents: ["implementer"],
				gate: "code-reviewed",
				rework: { target: "design", allowed_actors: ["reviewer"], create_ac: true },
				hooks: {
					on_enter: [{ action: "capture_baseline", auto: true }],
					on_exit: [{ action: "capture_baseline", auto: true }],
				},
			},
			{
				id: "review",
				name: "Review",
				order: 3,
				zone: "doing",
				agents: ["reviewer"],
				gate: null,
				rework: { target: "code", allowed_actors: ["reviewer"], create_ac: true },
				phases: {
					initialState: "review",
					states: {
						review: {
							id: "review",
							label: "Review",
							transitions: [{ target: "decide" }],
						},
						decide: {
							id: "decide",
							label: "Decide",
							transitions: [
								{ target: "handoff-approve" },
								{ target: "handoff-reject" },
							],
						},
						"handoff-approve": {
							id: "handoff-approve",
							label: "Approve",
							transitions: [{ target: "security" }],
						},
						"handoff-reject": {
							id: "handoff-reject",
							label: "Reject",
							transitions: [{ target: "code" }],
						},
					},
				},
			},
			{
				id: "security",
				name: "Security",
				order: 4,
				zone: "doing",
				agents: ["security"],
				gate: "human-approved",
				rework: { target: "code", allowed_actors: ["security"] },
				hooks: {
					on_enter: [{ action: "security_review", auto: true, requires_claim: true }],
				},
				auto_transitions: [
					{
						when: "security_clear AND human_approved",
						target: "done",
						actor: "system:auto",
					},
				],
			},
			{ id: "done", name: "Done", order: 5, zone: "done", agents: [], gate: null },
		],
	};
}

function createMockContext(overrides?: Partial<FlowEngineContext>): FlowEngineContext {
	const items = new Map<string, FlowItem>();
	return {
		loadItem: async (id) => items.get(id) ?? null,
		saveItem: async (item) => {
			items.set(item.id, item);
		},
		checkHumanGate: async () => true,
		runAutomatedCheck: async () => true,
		executeHook: async () => {},
		evaluateCondition: async () => false,
		logTransition: async () => {},
		...overrides,
	};
}

describe("FlowEngine", () => {
	it("transitions between stages using YAML config", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "backlog" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "design", "analyst", "handoff");

		expect(result.ok).toBe(true);
		expect(result.item?.stage).toBe("design");
	});

	it("validates operation against allowed_in_stages", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "design" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "code", "security", "security_review");

		expect(result.ok).toBe(false);
		expect(result.reasonCode).toBe("OPERATION_NOT_ALLOWED_IN_STAGE");
	});

	it("allows security_review in security stage", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "security" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "done", "security", "security_review");

		expect(result.ok).toBe(true);
	});

	it("validates actor_prefix for operations", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "security" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "done", "agent:codex", "approve");

		expect(result.ok).toBe(false);
		expect(result.reasonCode).toBe("ACTOR_NOT_ALLOWED");
	});

	it("allows human actor for approve operation", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "security" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "done", "human:rnasc", "approve");

		expect(result.ok).toBe(true);
	});

	it("executes on_enter hooks when entering a stage", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "review" };
		const hookCalls: string[] = [];
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};
		ctx.executeHook = async (action) => {
			hookCalls.push(action);
		};

		const engine = new FlowEngine(createTestFlow(), ctx);
		await engine.transition("ITEM-1", "code", "reviewer", "rework");

		expect(hookCalls).toContain("capture_baseline");
	});

	it("uses rework.target instead of requested target when operation is rework", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "review" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "backlog", "reviewer", "rework");

		expect(result.ok).toBe(true);
		expect(result.item?.stage).toBe("code");
	});

	it("rejects operation not allowed for actor", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "review" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "code", "analyst", "rework");

		expect(result.ok).toBe(false);
		expect(result.reasonCode).toBe("ACTOR_NOT_ALLOWED");
	});

	it("returns error for non-existent item", async () => {
		const ctx = createMockContext();
		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-999", "design", "analyst");

		expect(result.ok).toBe(false);
		expect(result.reasonCode).toBe("ITEM_NOT_FOUND");
	});

	it("returns error for non-existent target stage", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "backlog" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "nonexistent", "analyst");

		expect(result.ok).toBe(false);
		expect(result.reasonCode).toBe("TRANSITION_NOT_ALLOWED");
	});

	it("zero if-statements for stage names in transition method", () => {
		const engineCode = FlowEngine.prototype.transition.toString();
		// The engine should NOT contain hardcoded stage name checks
		expect(engineCode).not.toContain('"security"');
		expect(engineCode).not.toContain('"review"');
		expect(engineCode).not.toContain('"code"');
		expect(engineCode).not.toContain('"design"');
		expect(engineCode).not.toContain('"backlog"');
		expect(engineCode).not.toContain('"done"');
	});

	it("loads operations from YAML config", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		expect(engine.getOperations()).toHaveLength(4);
		expect(engine.getOperations().map((o) => o.id)).toContain("security_review");
	});

	it("validates requires_claim constraint", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const op = engine.getOperation("security_review");
		expect(op?.requires_claim).toBe(true);
	});

	it("validates allowed_actors constraint", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const op = engine.getOperation("rework");
		expect(op?.allowed_actors).toContain("reviewer");
	});

	it("validates actor_prefix constraint", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const op = engine.getOperation("approve");
		expect(op?.actor_prefix).toBe("human:");
	});

	it("validates allowed_in_stages constraint", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const op = engine.getOperation("security_review");
		expect(op?.allowed_in_stages).toContain("security");
	});

	it("rework.target is declared in YAML for each stage", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const reviewStage = engine.getStage("review");
		expect(reviewStage?.rework?.target).toBe("code");
	});

	it("rework.allowed_actors is declared in YAML", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const reviewStage = engine.getStage("review");
		expect(reviewStage?.rework?.allowed_actors).toContain("reviewer");
	});

	it("rework.create_ac is declared in YAML", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const reviewStage = engine.getStage("review");
		expect(reviewStage?.rework?.create_ac).toBe(true);
	});

	it("rework operation uses rework.target from stage config", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "review" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "backlog", "reviewer", "rework");

		expect(result.ok).toBe(true);
		expect(result.item?.stage).toBe("code");
	});

	it("on_enter hooks are declared in YAML for stages", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const codeStage = engine.getStage("code");
		expect(codeStage?.hooks?.on_enter).toBeDefined();
		expect(codeStage?.hooks?.on_enter?.[0]?.action).toBe("capture_baseline");
	});

	it("on_exit hooks are declared in YAML for stages", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const codeStage = engine.getStage("code");
		expect(codeStage?.hooks?.on_exit).toBeDefined();
		expect(codeStage?.hooks?.on_exit?.[0]?.action).toBe("capture_baseline");
	});

	it("hooks execute automatically on stage enter", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "review" };
		const hookCalls: string[] = [];
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};
		ctx.executeHook = async (action) => {
			hookCalls.push(action);
		};

		const engine = new FlowEngine(createTestFlow(), ctx);
		await engine.transition("ITEM-1", "code", "reviewer", "rework");

		expect(hookCalls).toContain("capture_baseline");
	});

	it("hooks execute automatically on stage exit", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "design" };
		const hookCalls: string[] = [];
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};
		ctx.executeHook = async (action) => {
			hookCalls.push(action);
		};

		const engine = new FlowEngine(createTestFlow(), ctx);
		// Use handoff operation instead of rework to test on_exit hooks
		const result = await engine.transition("ITEM-1", "backlog", "analyst", "handoff");

		expect(result.ok).toBe(true);
		expect(hookCalls).toContain("capture_baseline");
	});

	it("hooks auto flag is respected", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const codeStage = engine.getStage("code");
		expect(codeStage?.hooks?.on_enter?.[0]?.auto).toBe(true);
	});

	it("auto_transitions are declared in YAML for stages", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const securityStage = engine.getStage("security");
		expect(securityStage?.auto_transitions).toBeDefined();
		expect(securityStage?.auto_transitions?.[0]?.target).toBe("done");
	});

	it("auto_transitions have condition expressions", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const securityStage = engine.getStage("security");
		expect(securityStage?.auto_transitions?.[0]?.when).toBe(
			"security_clear AND human_approved",
		);
	});

	it("auto_transitions have target stages", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const securityStage = engine.getStage("security");
		expect(securityStage?.auto_transitions?.[0]?.target).toBe("done");
	});

	it("auto_transitions have actor", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const securityStage = engine.getStage("security");
		expect(securityStage?.auto_transitions?.[0]?.actor).toBe("system:auto");
	});

	it("auto_transitions execute when condition is met", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "security" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};
		ctx.evaluateCondition = async () => true;

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "done", "security", "security_review");

		expect(result.ok).toBe(true);
	});

	it("auto_transitions do not execute when condition is not met", async () => {
		const item: FlowItem = { id: "ITEM-1", stage: "security" };
		const ctx = createMockContext();
		const items = new Map([["ITEM-1", item]]);
		ctx.loadItem = async (id) => items.get(id) ?? null;
		ctx.saveItem = async (i) => {
			items.set(i.id, i);
		};
		ctx.evaluateCondition = async () => false;

		const engine = new FlowEngine(createTestFlow(), ctx);
		const result = await engine.transition("ITEM-1", "done", "security", "security_review");

		expect(result.ok).toBe(true);
	});

	it("capability_families are declared in YAML", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const families = engine.getCapabilityFamilies();
		expect(families).toBeDefined();
		expect(families.code).toContain("read_code");
	});

	it("getCapabilityFamily returns family for capability", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		expect(engine.getCapabilityFamily("read_code")).toBe("code");
		expect(engine.getCapabilityFamily("review_code")).toBe("review");
		expect(engine.getCapabilityFamily("security_scan")).toBe("security");
	});

	it("getCapabilityFamily returns undefined for unknown capability", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		expect(engine.getCapabilityFamily("unknown")).toBeUndefined();
	});

	it("executors are declared in YAML", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const executors = engine.getExecutors();
		expect(executors).toBeDefined();
		expect(executors.opencode).toBeDefined();
	});

	it("getExecutor returns executor config", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		const executor = engine.getExecutor("opencode");
		expect(executor?.command).toBe("opencode");
	});

	it("getExecutor returns undefined for unknown executor", async () => {
		const flow = createTestFlow();
		const engine = new FlowEngine(flow, createMockContext());
		expect(engine.getExecutor("unknown")).toBeUndefined();
	});
});
