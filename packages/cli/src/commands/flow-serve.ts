import { type IncomingMessage, type ServerResponse, createServer } from "node:http";

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { detectProjectName, loadWorkflow, writeWorkflow } from "./flow-init.js";
import type { Workflow } from "./flow-init.js";
import {
	loadHarness,
	resolveHarnessRoot,
	ensureSharedHarness,
	DEFAULT_HARNESS_VERSION,
} from "../harness/loader";
import { DiagnosticEngine } from "../diagnostics/engine.js";
import { resolveWorkspaceRoot } from "../workspace/resolver.js";
import type { WorkspaceResolution } from "../workspace/resolver.js";
import { listWorkspaces } from "../workspace/index.js";
import {
	loadHealthRecord,
	saveHealthRecord,
	ackEntry,
	dismissEntry,
	getSummary,
	getActiveEntries,
} from "../health-record.js";
import { logEntry, queryLog, queryLogWithMeta } from "../session-log.js";
import { clearFocusFile } from "../adapters/focus-sync.js";
import { writeFocusWithRecommendations } from "../adapters/focus-recommendations.js";
import { pulse } from "./pulse.js";
import { sitrep } from "./sitrep.js";
import { resolveActiveFlowFor } from "../flow-definition/resolve.js";
import { FlowServerEvents } from "../flow-serve/events.js";
import { runDiagnosticsAndSyncHealth, type DiagnosticsOutput } from "../flow-serve/diagnostics.js";
import {
	clearSpec,
	loadResolvedSpecs,
	readAllowedContextFile,
	validateSpec,
	writeSpec,
} from "../flow-serve/specs.js";
import {
	buildRequestedActivityContext,
	contextFileExists,
	readDecisions,
	readFocusDocument,
	readFocusState,
} from "../flow-serve/context.js";
import {
	analyzeWorkspaceSetup,
	captureWorkspaceSetup,
	createWorkflowFromTemplate as createWorkflowFromTemplateService,
	planWorkspaceSetup,
	registerWorkspaceSetup,
	rollbackWorkspaceSetup,
	saveWorkspaceSetupManifest,
	restoreWorkspaceSetup,
	writeExternalWorkspaceSetup,
	writeWorkspaceTargetAdapters,
} from "../flow-serve/workspace.js";
import { getRecurringSystemActions, logSystemAction } from "../flow-serve/system-actions.js";
import { createRequestContext } from "../flow-serve/request-context.js";
import { FlowServerRouter } from "../flow-serve/router.js";
import { createItemRoutes } from "../flow-serve/routes/item-routes.js";
import { createSpecRoutes } from "../flow-serve/routes/spec-routes.js";
import { createDiagnosticsRoutes } from "../flow-serve/routes/diagnostics-routes.js";
import { createContextRoutes } from "../flow-serve/routes/context-routes.js";
import { createWorkflowRoutes } from "../flow-serve/routes/workflow-routes.js";
import { createWorkspaceRoutes } from "../flow-serve/routes/workspace-routes.js";
import { createAdapterRoutes } from "../flow-serve/routes/adapter-routes.js";
import { createHandoffRoutes } from "../flow-serve/routes/handoff-routes.js";
import { ClientAssets } from "../flow-serve/client-assets.js";
import { AutomationRuntime, type AutomationBinding } from "../flow-serve/automation-runtime.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";

const DEFAULT_PORT = 3000;

/**
 * Resolve the harness directory for `root`, preferring the workspace-local
 * harness and falling back to the externalized shared harness (bootstrapping
 * it from the CLI defaults on first use). Used by flow-serve only — keeps
 * `letra flow init --quick` on its inline 5-stage default when no local
 * harness exists (see resolveHarnessRoot, which is local-only).
 */
function resolveHarnessWithShared(root: string): string {
	const local = resolveHarnessRoot(root, DEFAULT_HARNESS_VERSION);
	if (existsSync(local)) return local;
	return ensureSharedHarness(DEFAULT_HARNESS_VERSION);
}

function esc(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export class FlowServer {
	private server: ReturnType<typeof createServer> | undefined;
	private events = new FlowServerEvents();
	private router = new FlowServerRouter();
	private clientAssets: ClientAssets;
	private automationRuntime: AutomationRuntime;
	private orchestrator: Orchestrator;
	private port: number;
	private loadWorkflow: (root?: string) => Workflow | null;
	private engine: DiagnosticEngine;
	private resolution: WorkspaceResolution;
	private activeWorkspaceRoot: string;
	private activeDirectory: string | null = null;

	constructor(root: string, port: number = DEFAULT_PORT) {
		this.clientAssets = new ClientAssets(root);
		this.port = port;
		this.resolution = resolveWorkspaceRoot(root);
		this.activeWorkspaceRoot = this.resolution.workspaceRoot;
		this.loadWorkflow = (overrideRoot?: string) =>
			loadWorkflow(overrideRoot ?? this.activeWorkspaceRoot);
		this.engine = new DiagnosticEngine(this.activeWorkspaceRoot);
		this.automationRuntime = new AutomationRuntime({
			runDiagnostics: runDiagnosticsAndSyncHealth,
			broadcastWorkflow: () => this.broadcast(),
			broadcastDiagnostics: (output) => this.broadcastDiagnostics(output),
			logAction: (workspaceRoot, actionId, outcome, options) => {
				logSystemAction(workspaceRoot, actionId, {
					outcome,
					error: options?.error,
					details: options?.details,
				});
				this.events.broadcastSystemActionUpdated({ actionId, outcome });
			},
		});
		this.orchestrator = new Orchestrator({
			root: this.activeWorkspaceRoot,
			onHandoffEvent: (payload) => this.events.broadcastHandoff(payload),
		});
		this.orchestrator.registerFromManifest();
		this.router.register((context) => {
			if (context.path !== "/events") return false;
			this.events.handleSse(context.req, context.res);
			return true;
		});
		this.router.register(
			createItemRoutes({
				writeWorkflow,
				loadHealthRecord,
				writeFocusFile: writeFocusWithRecommendations,
				logEntry,
				resolveActiveFlow: resolveActiveFlowFor,
				broadcast: () => this.broadcast(),
				fireWebhooks: (workspaceRoot, event, payload) =>
					this.fireWebhooks(workspaceRoot, event, payload),
			}),
		);
		this.router.register(
			createSpecRoutes({
				loadResolvedSpecs,
				writeSpec,
				clearSpec,
				validateSpec,
				writeWorkflow,
				broadcast: () => this.broadcast(),
			}),
		);
		this.router.register(
			createDiagnosticsRoutes({
				engineFor: (workspaceRoot) =>
					workspaceRoot === this.activeWorkspaceRoot
						? this.engine
						: new DiagnosticEngine(workspaceRoot),
				runDiagnostics: runDiagnosticsAndSyncHealth,
				loadHealthRecord,
				saveHealthRecord,
				ackEntry,
				dismissEntry,
				getSummary,
				getActiveEntries,
				broadcast: () => this.broadcast(),
				broadcastDiagnostics: (output) => this.broadcastDiagnostics(output),
			}),
		);
		this.router.register(
			createContextRoutes({
				clearFocusFile,
				writeFocusFile: writeFocusWithRecommendations,
				logEntry,
				queryLog,
				queryLogWithMeta,
				readFocusState,
				readFocusDocument,
				readDecisions,
				readAllowedContextFile,
				contextFileExists,
				getRecurringSystemActions,
				sitrep,
				pulse,
				buildActivityContext: buildRequestedActivityContext,
				broadcast: () => this.broadcast(),
			}),
		);
		this.router.register(
			createWorkflowRoutes({
				writeWorkflow,
				resolveActiveFlow: resolveActiveFlowFor,
				detectWorkspaceName: detectProjectName,
				loadHarness: (workspaceRoot) =>
					loadHarness(resolveHarnessWithShared(workspaceRoot)),
				createFromTemplate: createWorkflowFromTemplateService,
				broadcast: () => this.broadcast(),
			}),
		);
		this.router.register(
			createWorkspaceRoutes({
				listWorkspaces,
				switchWorkspace: (root) => this.switchWorkspace(root),
				switchDirectory: (directory) => this.switchDirectory(directory),
				activeWorkspaceRoot: () => this.activeWorkspaceRoot,
				activeDirectory: () => this.activeDirectory,
				registerSetup: registerWorkspaceSetup,
				createFromTemplate: createWorkflowFromTemplateService,
				writeWorkflow,
				writeExternalSetup: writeExternalWorkspaceSetup,
				writeTargetAdapters: writeWorkspaceTargetAdapters,
				analyzeSetup: analyzeWorkspaceSetup,
				planSetup: planWorkspaceSetup,
				captureSetup: captureWorkspaceSetup,
				restoreSetup: restoreWorkspaceSetup,
				saveSetupManifest: saveWorkspaceSetupManifest,
				rollbackSetup: rollbackWorkspaceSetup,
				loadHarness: (root) => loadHarness(resolveHarnessWithShared(root)),
			}),
		);
		this.router.register(
			createAdapterRoutes({
				logEntry,
				broadcast: () => this.broadcast(),
			}),
		);
		this.router.register(
			createHandoffRoutes({
				getPendingHandoffs: (agentId?: string) => {
					const workflow = this.loadWorkflow();
					if (!workflow) return [];
					const now = new Date();
					return workflow.items
						.filter((item) => {
							if (!item.handoff) return false;
							if (new Date(item.handoff.expiresAt) < now) return false;
							if (agentId && item.handoff.to !== agentId) return false;
							return true;
						})
						.map((item) => ({
							itemId: item.id,
							from: item.handoff?.from ?? "",
							to: item.handoff?.to ?? "",
							summary: item.handoff?.summary ?? "",
							evidence: item.handoff?.evidence || [],
							executorId: item.handoff?.executorId,
							timestamp: item.handoff?.timestamp ?? "",
							expiresAt: item.handoff?.expiresAt ?? "",
						}));
				},
			}),
		);
	}

	switchWorkspace(workspaceRoot: string) {
		this.activeWorkspaceRoot = workspaceRoot;
		this.activeDirectory = null;
		this.resolution = resolveWorkspaceRoot(workspaceRoot);
		this.loadWorkflow = (overrideRoot?: string) =>
			loadWorkflow(overrideRoot ?? this.activeWorkspaceRoot);
		this.engine = new DiagnosticEngine(this.activeWorkspaceRoot);
		this.automationRuntime.rebind(this.automationBinding());
		this.orchestrator = new Orchestrator({
			root: this.activeWorkspaceRoot,
			onHandoffEvent: (payload) => this.events.broadcastHandoff(payload),
		});
		this.orchestrator.registerFromManifest();
		this.orchestrator.startReclaimTimer();
		this.broadcast();
	}

	switchDirectory(directory: string | null) {
		this.activeDirectory = directory;
		this.loadWorkflow = (overrideRoot?: string) =>
			loadWorkflow(overrideRoot ?? this.activeDirectory ?? this.activeWorkspaceRoot);
		this.broadcast();
	}

	private workspaceRootFor(url: URL): string {
		const ws = url.searchParams.get("workspace");
		if (ws) return resolve(ws);
		return this.activeDirectory ?? this.activeWorkspaceRoot;
	}

	private automationBinding(): AutomationBinding {
		return {
			workspaceRoot: this.activeWorkspaceRoot,
			workspaceDir: this.resolution.workspaceDir,
			engine: this.engine,
		};
	}

	private handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
		const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
		const path = url.pathname;
		const requestRoot = this.workspaceRootFor(url);
		const requestResolution = resolveWorkspaceRoot(requestRoot);
		const context = createRequestContext(req, res, url, {
			workspaceRoot: requestRoot,
			workspaceDir: requestResolution.workspaceDir,
			workflow: this.loadWorkflow(requestRoot),
		});
		if (await this.router.dispatch(context)) return;

		// Serve SPA (client/dist/) or proxy to Vite dev server
		this.clientAssets.serve(path, req, res);
	};

	private broadcast(): void {
		this.events.broadcastWorkflowUpdated();
	}

	private broadcastDiagnostics(output: DiagnosticsOutput): void {
		this.events.broadcastDiagnosticsUpdated({
			fixes: output.fixes.length,
			suggestions: output.suggestions.length,
			errors: output.errors.length,
		});
	}

	private async fireWebhooks(
		workspaceRoot: string,
		event: string,
		payload: Record<string, unknown>,
	): Promise<void> {
		const wf = this.loadWorkflow(workspaceRoot);
		if (!wf?.webhooks || wf.webhooks.length === 0) return;
		const matching = wf.webhooks.filter((wh) => wh.events.includes(event));
		if (matching.length === 0) return;
		const body = JSON.stringify({
			event,
			workflow: wf.name,
			timestamp: new Date().toISOString(),
			...payload,
		});
		for (const wh of matching) {
			try {
				const res = await fetch(wh.url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body,
				});
				wh.lastStatus = res.ok ? "ok" : "error";
			} catch {
				wh.lastStatus = "error";
			}
			wh.lastSentAt = new Date().toISOString();
		}
		writeWorkflow(workspaceRoot, {
			workflow: wf,
			source: "web-ui",
			skipAdapters: true,
			skipSitrep: true,
			skipLog: true,
			quiet: true,
		});
	}

	start(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.server = createServer(this.handleRequest);
			this.server.listen(this.port, () => {
				this.automationRuntime.start(this.automationBinding());
				this.orchestrator.startReclaimTimer();
				resolve();
			});
			this.server.on("error", reject);
		});
	}

	stop(): void {
		this.automationRuntime.stop();
		this.orchestrator.stopReclaimTimer();
		if (this.server) this.server.close();
		this.events.close();
	}

	getPort(): number {
		return this.port;
	}
}

export async function flowServeAction(
	targetPath: string | undefined,
	options?: { port?: number; open?: boolean },
): Promise<void> {
	const root = resolve(process.cwd(), targetPath ?? ".");
	const port = options?.port ?? DEFAULT_PORT;

	const wf = loadWorkflow(root);
	if (!wf) {
		console.log("No workflow found. Run 'letra flow init --quick' first");
		return;
	}

	const server = new FlowServer(root, port);
	try {
		await server.start();
		console.log(`\n  Flow Board → http://localhost:${port}\n`);
		console.log("  Press Ctrl+C to stop\n");

		if (options?.open) {
			const { execSync } = await import("node:child_process");
			const cmd =
				process.platform === "win32"
					? "start"
					: process.platform === "darwin"
						? "open"
						: "xdg-open";
			try {
				execSync(`${cmd} http://localhost:${port}`, { stdio: "ignore" });
			} catch {}
		}

		await new Promise<void>((resolve) => {
			process.on("SIGINT", () => {
				server.stop();
				resolve();
			});
		});
	} catch (err) {
		console.error(`Failed to start server on port ${port}:`, (err as Error).message);
		process.exit(1);
	}
}
