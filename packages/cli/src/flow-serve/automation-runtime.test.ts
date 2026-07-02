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
});
