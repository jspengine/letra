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
import { createAgentRoutes } from "../flow-serve/routes/agent-routes.js";
import { createSecurityReviewRoutes } from "../flow-serve/routes/security-review-routes.js";
import {
	createAutopilotRoutes,
	type AutopilotStatus,
} from "../flow-serve/routes/autopilot-routes.js";
import { ClientAssets } from "../flow-serve/client-assets.js";
import { AutomationRuntime, type AutomationBinding } from "../flow-serve/automation-runtime.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { PersistentDispatcher } from "../orchestrator/dispatcher.js";
import { createCodexExecutor } from "../orchestrator/codex-executor.js";
import { HumanSessionGateway } from "../flow-serve/human-session.js";
import { resolveExecutionWorkspace } from "../orchestrator/execution-workspace.js";
import type { AgenticExecutor } from "../executor/executor.js";
import { loadRuntimeAgentRegistry } from "../agents/service.js";
import { resolveRuntimeBinding } from "../agents/runtime-binding.js";
import { resolveAgentDirection } from "../agent-direction/service.js";
import { inspectWorkspaceIntegrity } from "../workspace/integrity.js";
import {
	claimOperation,
	recordExecutionEvent,
	submitEvidenceOperation,
	requestTransitionOperation,
	requestHandoffOperation,
	runValidationOperation,
	decideGateOperation,
	releaseClaimOperation,
	activateWorkOperation,
	requestReworkOperation,
	createItemOperation,
	updateItemOperation,
	deleteItemOperation,
	reclaimExpiredClaimsOperation,
	hasLiveClaim,
	runSecurityReviewOperation,
} from "../domain-operations/service.js";

const DEFAULT_PORT = 3000;
export interface FlowServerOptions {
	autopilot?: boolean;
	dispatcherIntervalMs?: number;
	executorFactory?: (root: string, capabilities: string[]) => AgenticExecutor[];
}

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
	private humanSessions: HumanSessionGateway;
	private clientAssets: ClientAssets;
	private automationRuntime: AutomationRuntime;
	private orchestrator: Orchestrator;
	private port: number;
	private loadWorkflow: (root?: string) => Workflow | null;
	private engine: DiagnosticEngine;
	private resolution: WorkspaceResolution;
	private activeWorkspaceRoot: string;
	private activeDirectory: string | null = null;
	private dispatcher: PersistentDispatcher | undefined;
	private runtimeExecutors: AgenticExecutor[] = [];
	private autopilotEnabled: boolean;
	private autopilotUpdatedAt: string | null = null;
	private readonly options: FlowServerOptions;

	constructor(root: string, port: number = DEFAULT_PORT, options: FlowServerOptions = {}) {
		this.options = options;
		this.autopilotEnabled = options.autopilot === true;
		this.clientAssets = new ClientAssets(root);
		this.port = port;
		this.resolution = resolveWorkspaceRoot(root);
		// Keep an invalid link anchored at the caller's existing location. This
		// lets HTTP operation routes reach the shared fail-closed gateway instead
		// of dereferencing a missing canonical target or falling back to .letra.
		this.activeWorkspaceRoot = this.resolution.errorCode === "WORKSPACE_LINK_INVALID"
					? this.resolution.locationPath
					: this.resolution.workspaceRoot;
				this.humanSessions = new HumanSessionGateway(this.activeWorkspaceRoot);
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
		if (this.autopilotEnabled) this.dispatcher = this.createDispatcher();
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
				decideGateOperation: (root, input) => decideGateOperation(root, input),
				claimOperation: (root, input) => claimOperation(root, input),
					releaseClaimOperation: (root, input) => releaseClaimOperation(root, input),
				requestTransitionOperation: (root, input) => requestTransitionOperation(root, input),
				activateWorkOperation: (root, input) => activateWorkOperation(root, input),
				requestReworkOperation: (root, input) => requestReworkOperation(root, input),
				createItemOperation: (root, input) => createItemOperation(root, input),
				updateItemOperation: (root, input) => updateItemOperation(root, input),
				deleteItemOperation: (root, input) => deleteItemOperation(root, input),
				runValidationOperation: (root, input) => runValidationOperation(root, input),
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
				inspectWorkspaceIntegrity,
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
				// Publish/rollback is a human-confirmed action. Do not derive this
				// identity from request bodies or a permissive default.
				resolveHumanActor: (req) => this.humanSessions.resolveHumanActor(req),
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
		this.router.register(createSecurityReviewRoutes());
		this.router.register(createAgentRoutes({
			loadWorkflow: (root) => this.loadWorkflow(root),
			loadRuntimeRegistry: (root, workflow) => loadRuntimeAgentRegistry(root, workflow),
			getExecutors: () => this.runtimeExecutors,
			broadcast: () => this.broadcast(),
		}));
		this.router.register(
			createAutopilotRoutes({
				getStatus: (workspaceRoot) => this.getAutopilotStatus(workspaceRoot),
				setEnabled: (workspaceRoot, enabled) => this.setAutopilotEnabled(workspaceRoot, enabled),
			}),
		);
	}

	private getAutopilotStatus(workspaceRoot: string): AutopilotStatus {
		const workflow = this.loadWorkflow(workspaceRoot);
		const items = workflow?.items ?? [];
		return {
			enabled: this.autopilotEnabled,
			activeItems: items.filter((item) => hasLiveClaim(item)).length,
			waitingHuman: items.filter(
				(item) => item.handoff?.to === "human" || item.handoff?.to?.startsWith("human:"),
			).length,
			updatedAt: this.autopilotUpdatedAt,
		};
	}

	private setAutopilotEnabled(workspaceRoot: string, enabled: boolean): AutopilotStatus {
		if (workspaceRoot !== this.activeWorkspaceRoot) {
			throw new Error("Autopilot can only be controlled for the active workspace.");
		}
		if (enabled === this.autopilotEnabled) return this.getAutopilotStatus(workspaceRoot);

		this.autopilotEnabled = enabled;
		this.autopilotUpdatedAt = new Date().toISOString();
		if (enabled) {
			this.dispatcher ??= this.createDispatcher();
			this.dispatcher.start();
		} else {
			this.dispatcher?.stop();
		}
		logEntry(
			workspaceRoot,
			"system",
			`Autopilot ${enabled ? "enabled" : "paused"} via UI`,
			{ details: { enabled, source: "web-ui", timestamp: this.autopilotUpdatedAt } },
		);
		this.broadcast();
		return this.getAutopilotStatus(workspaceRoot);
	}

	private createDispatcher(): PersistentDispatcher {
		const manifest = this.orchestrator.getManifest();
		// The preview executor must use the canonical capability vocabulary from
		// the active harness roles. Stage labels such as "code" are not
		// protocol capabilities.
		const harnessCapabilities = manifest
			? Object.values(manifest.roles).flatMap((role) => role.capabilities)
			: [];
		const capabilities = harnessCapabilities.length > 0
			? [...new Set(harnessCapabilities)]
			: [
					"read_code",
					"write_spec",
					"generate_doc",
					"write_code",
					"run_tests",
					"review_code",
					"security_scan",
					"dependency_audit",
				];
		const executionWorkspace = resolveExecutionWorkspace({
			workflow: this.loadWorkflow() ?? { version: "1", name: "empty", createdAt: "", updatedAt: "", stages: [], items: [], tools: [] },
			workspaceRoot: this.activeWorkspaceRoot,
			selectedDirectory: this.activeDirectory,
		});
		const executors = this.options.executorFactory
			? this.options.executorFactory(this.activeWorkspaceRoot, capabilities)
			: [createCodexExecutor({
					root: executionWorkspace.ok ? executionWorkspace.root : this.activeWorkspaceRoot,
					capabilities,
				})];
		this.runtimeExecutors = executors;
		return new PersistentDispatcher(
			{
				loadWorkflow: () => {
					const workflow = this.loadWorkflow();
					if (!workflow) throw new Error("No workflow found for dispatcher");
					return workflow;
				},
				operations: {
					getDirection: () => resolveAgentDirection(this.activeWorkspaceRoot),
					claim: (input) => claimOperation(this.activeWorkspaceRoot, { ...input, ttlMinutes: 30 }),
					event: (input) => recordExecutionEvent(this.activeWorkspaceRoot, input),
					evidence: (input) => submitEvidenceOperation(this.activeWorkspaceRoot, input),
					validate: (input) => runValidationOperation(this.activeWorkspaceRoot, input),
					securityReview: (input) => runSecurityReviewOperation(this.activeWorkspaceRoot, input),
					transition: (input) => requestTransitionOperation(this.activeWorkspaceRoot, input),
					handoff: (input) => requestHandoffOperation(this.activeWorkspaceRoot, input),
					release: (input) => releaseClaimOperation(this.activeWorkspaceRoot, input),
					reclaimExpired: (input) => reclaimExpiredClaimsOperation(this.activeWorkspaceRoot, input),
				},
			},
			() => executors,
			this.options.dispatcherIntervalMs ?? 30_000,
			{
				stageActors: (stageId) => {
					const templateId = this.loadWorkflow()?.template ?? "flow-main";
					return manifest?.flows[templateId]?.stages.find((stage) => stage.id === stageId)?.agents ?? [];
				},
				stageCapability: (stage) => {
					const templateId = this.loadWorkflow()?.template ?? "flow-main";
					const stageDef = manifest?.flows[templateId]?.stages.find((entry) => entry.id === stage.id);
					const roleId = stageDef?.agents?.[0];
					return manifest?.roles[roleId ?? ""]?.capabilities?.find((capability) => capability !== "read_code") ?? stage.id;
				},
				executorPreference: (stage) => {
					const templateId = this.loadWorkflow()?.template ?? "flow-main";
					const roleId = manifest?.flows[templateId]?.stages.find((entry) => entry.id === stage.id)?.agents?.[0];
					const configured = manifest?.executors?.stageExecutorPreferences?.[roleId ?? stage.id];
					if (configured?.length) return configured;
					const preferred = (stage as typeof stage & { preferredExecutor?: string }).preferredExecutor;
					return preferred ? [preferred] : [];
				},
				resolveExecutionWorkspace: (_stage, _item) => {
					const workflow = this.loadWorkflow();
					if (!workflow) return { ok: false, reasonCode: "EXECUTION_WORKSPACE_UNAVAILABLE", reason: "Workflow indisponível para resolver o local de execução." };
					return resolveExecutionWorkspace({ workflow, workspaceRoot: this.activeWorkspaceRoot, selectedDirectory: this.activeDirectory });
				},
				resolveBinding: (stage, item, actor, capability, runtimeExecutors) => {
					const workflow = this.loadWorkflow();
					if (!workflow) return { ok: false, reasonCode: "NO_COMPATIBLE_BINDING" as const, reason: "Workflow indisponível para resolver vínculo operacional." };
					const active = resolveActiveFlowFor(this.activeWorkspaceRoot, workflow);
					const registry = loadRuntimeAgentRegistry(this.activeWorkspaceRoot, workflow);
					return resolveRuntimeBinding({ registry, workflow, manifest: active.harness ?? manifest, stageId: stage.id, actor, capability, executors: runtimeExecutors });
				},
				blocksHandoff: (stage, item) => {
					const gate = stage.gate ? manifest?.gates[stage.gate] : undefined;
					// A human gate protects entry into the next role. The role that
					// owns the current stage must still be allowed to execute and
					// produce the evidence presented at that gate.
					const currentActor = (manifest?.flows[this.loadWorkflow()?.template ?? "flow-main"]?.stages.find((entry) => entry.id === stage.id)?.agents ?? (stage as typeof stage & { agents?: string[] }).agents)?.[0];
					return gate?.type === "human" && gate.blocking === true && gate.blocksHandoff === true && item.handoff?.to !== currentActor;
				},
				onResult: (result) => {
					logEntry(this.activeWorkspaceRoot, "agent_execution_event", `Autonomous dispatcher: ${result.status}`, {
						itemId: result.itemId,
						details: { status: result.status, reason: result.reason ?? null },
					});
					this.broadcast();
				},
			},
		);
	}

	switchWorkspace(workspaceRoot: string) {
		this.activeWorkspaceRoot = workspaceRoot;
		this.activeDirectory = null;
		this.runtimeExecutors = [];
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
		if (this.autopilotEnabled) {
			this.dispatcher?.stop();
			this.dispatcher = this.createDispatcher();
			this.dispatcher.start();
		}
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
		this.humanSessions.establishNavigationSession(req, res);
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
				this.dispatcher?.start();
				resolve();
			});
			this.server.on("error", reject);
		});
	}

	stop(): void {
		this.automationRuntime.stop();
		this.dispatcher?.stop();
		if (this.server) this.server.close();
		this.events.close();
	}

	getPort(): number {
		return this.port;
	}
}

export async function flowServeAction(
	targetPath: string | undefined,
	options?: { port?: number; open?: boolean; autopilot?: boolean },
): Promise<void> {
	const root = resolve(process.cwd(), targetPath ?? ".");
	const port = options?.port ?? DEFAULT_PORT;

	const wf = loadWorkflow(root);
	if (!wf) {
		console.log("No workflow found. Run 'letra flow init --quick' first");
		return;
	}

	const server = new FlowServer(root, port, { autopilot: options?.autopilot });
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
