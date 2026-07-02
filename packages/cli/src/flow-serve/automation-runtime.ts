import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import type { DiagnosticEngine } from "../diagnostics/engine.js";
import type { DiagnosticsOutput } from "./diagnostics.js";

export interface AutomationBinding {
	workspaceRoot: string;
	workspaceDir: string;
	engine: DiagnosticEngine;
}

interface AutomationRuntimeDependencies {
	runDiagnostics: (engine: DiagnosticEngine, root: string) => Promise<DiagnosticsOutput>;
	broadcastWorkflow: () => void;
	broadcastDiagnostics: (output: DiagnosticsOutput) => void;
	logAction: (
		root: string,
		actionId: string,
		outcome: "armed" | "triggered" | "completed" | "failed",
		options?: { error?: string; details?: Record<string, unknown> },
	) => void;
	intervalMs?: number;
}

export class AutomationRuntime {
	private workflowWatcher: ReturnType<typeof watch> | undefined;
	private specsWatcher: ReturnType<typeof watch> | undefined;
	private diagnosticsTimer: ReturnType<typeof setInterval> | undefined;
	private binding: AutomationBinding | undefined;

	constructor(private readonly dependencies: AutomationRuntimeDependencies) {}

	start(binding: AutomationBinding): void {
		this.rebind(binding);
	}

	rebind(binding: AutomationBinding): void {
		this.closeResources();
		this.binding = binding;
		this.armWatchers(binding);
		binding.engine.ensureDirs();
		this.dependencies.logAction(binding.workspaceRoot, "diagnostics-scan", "armed");
		this.scan("startup");
		this.diagnosticsTimer = setInterval(
			() => this.scan("interval"),
			this.dependencies.intervalMs ?? 30_000,
		);
	}

	stop(): void {
		this.closeResources();
		this.binding = undefined;
	}

	private armWatchers(binding: AutomationBinding): void {
		const workflowPath = join(binding.workspaceDir, "workflow.json");
		if (existsSync(workflowPath)) {
			try {
				this.dependencies.logAction(binding.workspaceRoot, "workflow-watch", "armed", {
					details: { path: workflowPath },
				});
				this.workflowWatcher = watch(workflowPath, () => {
					this.dependencies.logAction(binding.workspaceRoot, "workflow-watch", "triggered", {
						details: { path: workflowPath },
					});
					this.dependencies.broadcastWorkflow();
					this.dependencies.logAction(binding.workspaceRoot, "workflow-watch", "completed", {
						details: { path: workflowPath },
					});
				});
			} catch {}
		}
		const specsPath = join(binding.workspaceDir, "specs");
		if (existsSync(specsPath)) {
			try {
				this.dependencies.logAction(binding.workspaceRoot, "specs-watch", "armed", {
					details: { path: specsPath },
				});
				this.specsWatcher = watch(specsPath, { recursive: true }, () => {
					this.dependencies.logAction(binding.workspaceRoot, "specs-watch", "triggered", {
						details: { path: specsPath },
					});
					this.dependencies.broadcastWorkflow();
					this.dependencies.logAction(binding.workspaceRoot, "specs-watch", "completed", {
						details: { path: specsPath },
					});
				});
			} catch {}
		}
	}

	private scan(reason: "startup" | "interval"): void {
		const binding = this.binding;
		if (!binding) return;
		this.dependencies.logAction(binding.workspaceRoot, "diagnostics-scan", "triggered", {
			details: { reason },
		});
		void this.dependencies.runDiagnostics(binding.engine, binding.workspaceRoot)
			.then((output) => {
				if (this.binding !== binding) return;
				this.dependencies.broadcastDiagnostics(output);
				this.dependencies.logAction(binding.workspaceRoot, "diagnostics-scan", "completed", {
					details: {
						reason,
						fixes: output.fixes.length,
						suggestions: output.suggestions.length,
						errors: output.errors.length,
					},
				});
			})
			.catch((error: unknown) => {
				this.dependencies.logAction(binding.workspaceRoot, "diagnostics-scan", "failed", {
					details: { reason },
					error: error instanceof Error ? error.message : String(error),
				});
			});
	}

	private closeResources(): void {
		this.workflowWatcher?.close();
		this.specsWatcher?.close();
		if (this.diagnosticsTimer) clearInterval(this.diagnosticsTimer);
		this.workflowWatcher = undefined;
		this.specsWatcher = undefined;
		this.diagnosticsTimer = undefined;
	}
}
