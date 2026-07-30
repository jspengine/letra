import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import type { DiagnosticEngine } from "../diagnostics/engine.js";
import type { DiagnosticsOutput } from "./diagnostics.js";

interface WatchHandle {
	close(): void;
}

type WatchPath = (
	path: string,
	options: { recursive?: boolean },
	listener: () => void,
) => WatchHandle;

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
	debounceMs?: number;
	pathExists?: (path: string) => boolean;
	watchPath?: WatchPath;
	reportError?: (message: string, error: unknown) => void;
}

export class AutomationRuntime {
	private workflowWatcher: WatchHandle | undefined;
	private specsWatcher: WatchHandle | undefined;
	private workflowDebounceTimer: ReturnType<typeof setTimeout> | undefined;
	private specsDebounceTimer: ReturnType<typeof setTimeout> | undefined;
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
		this.safeLogAction(binding.workspaceRoot, "diagnostics-scan", "armed");
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
		const pathExists = this.dependencies.pathExists ?? existsSync;
		const watchPath: WatchPath =
			this.dependencies.watchPath ??
			((path, options, listener) => watch(path, options, listener));
		if (pathExists(workflowPath)) {
			try {
				this.safeLogAction(binding.workspaceRoot, "workflow-watch", "armed", {
					details: { path: workflowPath },
				});
				this.workflowWatcher = watchPath(workflowPath, {}, () => {
					if (this.workflowDebounceTimer) clearTimeout(this.workflowDebounceTimer);
					this.workflowDebounceTimer = setTimeout(() => {
						this.workflowDebounceTimer = undefined;
						this.publishWorkflowChange(binding, "workflow-watch", workflowPath);
					}, this.dependencies.debounceMs ?? 100);
				});
			} catch {}
		}
		const specsPath = join(binding.workspaceDir, "specs");
		if (pathExists(specsPath)) {
			try {
				this.safeLogAction(binding.workspaceRoot, "specs-watch", "armed", {
					details: { path: specsPath },
				});
				this.specsWatcher = watchPath(specsPath, { recursive: true }, () => {
					if (this.specsDebounceTimer) clearTimeout(this.specsDebounceTimer);
					this.specsDebounceTimer = setTimeout(() => {
						this.specsDebounceTimer = undefined;
						this.publishWorkflowChange(binding, "specs-watch", specsPath);
					}, this.dependencies.debounceMs ?? 100);
				});
			} catch {}
		}
	}

	private publishWorkflowChange(
		binding: AutomationBinding,
		actionId: "workflow-watch" | "specs-watch",
		path: string,
	): void {
		if (this.binding !== binding) return;
		this.safeLogAction(binding.workspaceRoot, actionId, "triggered", {
			details: { path },
		});
		this.dependencies.broadcastWorkflow();
		this.safeLogAction(binding.workspaceRoot, actionId, "completed", {
			details: { path },
		});
	}

	private safeLogAction(
		root: string,
		actionId: string,
		outcome: "armed" | "triggered" | "completed" | "failed",
		options?: { error?: string; details?: Record<string, unknown> },
	): void {
		try {
			this.dependencies.logAction(root, actionId, outcome, options);
		} catch (error) {
			const reportError =
				this.dependencies.reportError ??
				((message: string, cause: unknown) => console.warn(message, cause));
			reportError(
				`Flow automation "${actionId}" could not persist outcome "${outcome}".`,
				error,
			);
		}
	}

	private scan(reason: "startup" | "interval"): void {
		const binding = this.binding;
		if (!binding) return;
		this.safeLogAction(binding.workspaceRoot, "diagnostics-scan", "triggered", {
			details: { reason },
		});
		void this.dependencies.runDiagnostics(binding.engine, binding.workspaceRoot)
			.then((output) => {
				if (this.binding !== binding) return;
				this.dependencies.broadcastDiagnostics(output);
				this.safeLogAction(binding.workspaceRoot, "diagnostics-scan", "completed", {
					details: {
						reason,
						fixes: output.fixes.length,
						suggestions: output.suggestions.length,
						errors: output.errors.length,
					},
				});
			})
			.catch((error: unknown) => {
				this.safeLogAction(binding.workspaceRoot, "diagnostics-scan", "failed", {
					details: { reason },
					error: error instanceof Error ? error.message : String(error),
				});
			});
	}

	private closeResources(): void {
		this.workflowWatcher?.close();
		this.specsWatcher?.close();
		if (this.workflowDebounceTimer) clearTimeout(this.workflowDebounceTimer);
		if (this.specsDebounceTimer) clearTimeout(this.specsDebounceTimer);
		if (this.diagnosticsTimer) clearInterval(this.diagnosticsTimer);
		this.workflowWatcher = undefined;
		this.specsWatcher = undefined;
		this.workflowDebounceTimer = undefined;
		this.specsDebounceTimer = undefined;
		this.diagnosticsTimer = undefined;
	}
}
