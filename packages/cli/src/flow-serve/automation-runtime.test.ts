import { afterEach, describe, expect, it, vi } from "vitest";
import type { DiagnosticEngine } from "../diagnostics/engine.js";
import { AutomationRuntime } from "./automation-runtime.js";

describe("AutomationRuntime", () => {
	afterEach(() => vi.useRealTimers());

	it("rebinds recurring diagnostics without retaining the previous timer", async () => {
		vi.useFakeTimers();
		const runDiagnostics = vi.fn().mockResolvedValue({
			fixes: [],
			suggestions: [],
			errors: [],
		});
		const firstEngine = { ensureDirs: vi.fn() } as unknown as DiagnosticEngine;
		const secondEngine = { ensureDirs: vi.fn() } as unknown as DiagnosticEngine;
		const runtime = new AutomationRuntime({
			runDiagnostics,
			broadcastWorkflow: vi.fn(),
			broadcastDiagnostics: vi.fn(),
			logAction: vi.fn(),
			intervalMs: 100,
		});

		runtime.start({
			workspaceRoot: "C:\\missing-a",
			workspaceDir: "C:\\missing-a\\.letra",
			engine: firstEngine,
		});
		runtime.rebind({
			workspaceRoot: "C:\\missing-b",
			workspaceDir: "C:\\missing-b\\.letra",
			engine: secondEngine,
		});
		await vi.advanceTimersByTimeAsync(100);

		expect(runDiagnostics).toHaveBeenCalledTimes(3);
		expect(runDiagnostics).toHaveBeenLastCalledWith(secondEngine, "C:\\missing-b");
		runtime.stop();
	});

	it("coalesces a burst of specs changes into one auditable update", async () => {
		vi.useFakeTimers();
		let specsListener: (() => void) | undefined;
		const broadcastWorkflow = vi.fn();
		const logAction = vi.fn();
		const runtime = new AutomationRuntime({
			runDiagnostics: vi.fn().mockResolvedValue({ fixes: [], suggestions: [], errors: [] }),
			broadcastWorkflow,
			broadcastDiagnostics: vi.fn(),
			logAction,
			pathExists: (path) => path.endsWith("specs"),
			watchPath: (path, _options, listener) => {
				if (path.endsWith("specs")) specsListener = listener;
				return { close: vi.fn() };
			},
			debounceMs: 50,
		});

		runtime.start({
			workspaceRoot: "C:\\workspace",
			workspaceDir: "C:\\workspace\\.letra",
			engine: { ensureDirs: vi.fn() } as unknown as DiagnosticEngine,
		});
		specsListener?.();
		specsListener?.();
		specsListener?.();
		await vi.advanceTimersByTimeAsync(50);

		expect(broadcastWorkflow).toHaveBeenCalledTimes(1);
		expect(logAction).toHaveBeenCalledWith(
			"C:\\workspace",
			"specs-watch",
			"triggered",
			expect.any(Object),
		);
		expect(logAction).toHaveBeenCalledWith(
			"C:\\workspace",
			"specs-watch",
			"completed",
			expect.any(Object),
		);
		runtime.stop();
	});

	it("reports audit failures without throwing from a watcher callback", async () => {
		vi.useFakeTimers();
		let specsListener: (() => void) | undefined;
		const reportError = vi.fn();
		const broadcastWorkflow = vi.fn();
		const runtime = new AutomationRuntime({
			runDiagnostics: vi.fn().mockResolvedValue({ fixes: [], suggestions: [], errors: [] }),
			broadcastWorkflow,
			broadcastDiagnostics: vi.fn(),
			logAction: vi.fn(() => {
				throw Object.assign(new Error("session log locked"), { code: "UNKNOWN" });
			}),
			reportError,
			pathExists: (path) => path.endsWith("specs"),
			watchPath: (_path, _options, listener) => {
				specsListener = listener;
				return { close: vi.fn() };
			},
			debounceMs: 10,
		});

		expect(() =>
			runtime.start({
				workspaceRoot: "C:\\workspace",
				workspaceDir: "C:\\workspace\\.letra",
				engine: { ensureDirs: vi.fn() } as unknown as DiagnosticEngine,
			}),
		).not.toThrow();
		specsListener?.();
		await vi.advanceTimersByTimeAsync(10);

		expect(broadcastWorkflow).toHaveBeenCalledOnce();
		expect(reportError).toHaveBeenCalled();
		runtime.stop();
	});
});
