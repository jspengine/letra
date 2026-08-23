import { describe, expect, it } from "vitest";
import { ExecutorRegistry, type AgenticExecutor } from "./executor.js";

function createExecutor(overrides?: Partial<AgenticExecutor>): AgenticExecutor {
	return {
		id: "test-executor",
		label: "Test Executor",
		capabilities: ["code", "review"],
		status: "online",
		execute: async () => ({ success: true, output: "done", artifacts: [], evidences: [] }),
		...overrides,
	};
}

describe("ExecutorRegistry", () => {
	describe("register and get", () => {
		it("registers an executor", () => {
			const registry = new ExecutorRegistry();
			const executor = createExecutor();
			registry.register(executor);
			expect(registry.get("test-executor")).toBe(executor);
		});

		it("returns undefined for unregistered executor", () => {
			const registry = new ExecutorRegistry();
			expect(registry.get("nonexistent")).toBeUndefined();
		});

		it("unregisters an executor", () => {
			const registry = new ExecutorRegistry();
			registry.register(createExecutor());
			registry.unregister("test-executor");
			expect(registry.get("test-executor")).toBeUndefined();
		});
	});

	describe("getAll", () => {
		it("returns all executors", () => {
			const registry = new ExecutorRegistry();
			registry.register(createExecutor({ id: "executor-1" }));
			registry.register(createExecutor({ id: "executor-2" }));
			expect(registry.getAll()).toHaveLength(2);
		});
	});

	describe("getByCapability", () => {
		it("returns executors with capability", () => {
			const registry = new ExecutorRegistry();
			registry.register(createExecutor({ id: "code-executor", capabilities: ["code"] }));
			registry.register(createExecutor({ id: "review-executor", capabilities: ["review"] }));
			registry.register(createExecutor({ id: "both-executor", capabilities: ["code", "review"] }));

			const codeExecutors = registry.getByCapability("code");
			expect(codeExecutors).toHaveLength(2);
			expect(codeExecutors.map((e) => e.id)).toContain("code-executor");
			expect(codeExecutors.map((e) => e.id)).toContain("both-executor");
		});
	});

	describe("getOnline", () => {
		it("returns only online executors", () => {
			const registry = new ExecutorRegistry();
			registry.register(createExecutor({ id: "online", status: "online" }));
			registry.register(createExecutor({ id: "offline", status: "offline" }));

			const online = registry.getOnline();
			expect(online).toHaveLength(1);
			expect(online[0].id).toBe("online");
		});
	});

	describe("selectForStage", () => {
		it("selects preferred executor for stage", () => {
			const registry = new ExecutorRegistry();
			registry.register(createExecutor({ id: "opencode", capabilities: ["code"] }));
			registry.register(createExecutor({ id: "cursor", capabilities: ["code"] }));
			registry.setStagePreference("code", ["cursor", "opencode"]);

			const selected = registry.selectForStage("code", "code");
			expect(selected?.id).toBe("cursor");
		});

		it("falls back to first capable executor when preferred is offline", () => {
			const registry = new ExecutorRegistry();
			registry.register(createExecutor({ id: "opencode", capabilities: ["code"] }));
			registry.register(createExecutor({ id: "cursor", capabilities: ["code"], status: "offline" }));
			registry.setStagePreference("code", ["cursor", "opencode"]);

			const selected = registry.selectForStage("code", "code");
			expect(selected?.id).toBe("opencode");
		});

		it("returns null when no executor has capability", () => {
			const registry = new ExecutorRegistry();
			registry.register(createExecutor({ id: "code-executor", capabilities: ["code"] }));

			const selected = registry.selectForStage("code", "security");
			expect(selected).toBeNull();
		});

		it("returns null when no executors registered", () => {
			const registry = new ExecutorRegistry();
			const selected = registry.selectForStage("code", "code");
			expect(selected).toBeNull();
		});
	});
});
