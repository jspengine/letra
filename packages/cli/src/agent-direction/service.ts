import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
	AgentDirectionAction,
	AgentDirectionCommand,
	AgentDirectionSnapshot,
	FlowActivityHint,
	GovernanceReference,
	ResolvedFlowDefinition,
	ResolvedFlowStage,
} from "@letra/types";
import { loadWorkflow, type Item, type Workflow } from "../commands/flow-init.js";
import { resolveActiveFlow, resolveActiveFlowFor } from "../flow-definition/resolve.js";
import { getLetraDir, resolveWorkspaceRoot } from "./../workspace/resolver.js";
import { invalidWorkspaceDiagnostic } from "../workspace/integrity.js";
import { isRunActiveForDirection, readExecutionRuns } from "../execution-runs/store.js";
import { createWorkspaceBoundary } from "../security/workspace-boundary.js";
import { withWorkspaceTransactionLockSync } from "../domain-operations/workspace-transaction.js";

export interface ResolveDirectionOptions {
	runId?: string;
	executorId?: string;
	itemId?: string;
	workflowVersionId?: string;
}

export interface CreateAgentDirectionSnapshotInput {
	workspaceRoot: string;
	workflow: Workflow | null;
	flow: ResolvedFlowDefinition | null;
	specContent: string | null;
	currentItemId?: string | null;
	now?: string;
	constitutionVersion?: string | null;
}

function slug(value: string): string {
	return (
		value
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "action"
	);
}

function findCurrentItem(workflow: Workflow, currentItemId?: string | null): Item | null {
	const items = Array.isArray(workflow.items) ? workflow.items : [];
	if (currentItemId) {
		const explicit = items.find((item) => item.id === currentItemId);
		if (explicit) return explicit;
	}
	return null;
}

function firstPendingAC(content: string | null): AgentDirectionSnapshot["pendingAC"] {
	if (!content) return null;
	// Review criteria are generated after the initial Acceptance Criteria
	// section and may use either the regular bold label or the compact
	// checklist form.  Direction is the operation contract, so it must keep
	// recognizing both forms instead of silently ending the AC loop.
	const match = content.match(/-\s*\[ \]\s*(?:\*\*([^*]+)\*\*|([^:\r\n]+))\s*:?\s*([^\r\n]*)/);
	if (!match) return null;
	const label = (match[1] ?? match[2] ?? "").trim();
	const description = (match[3] ?? "").trim();
	const id = label.match(/\bAC(?:[\s-]?gap[\s-]?(\d+(?:\.\d+)*)|[\s-]?(\d+(?:\.\d+)*))\b/i);
	if (!id) return null;
	return {
		id: id[1] ? `AC-gap-${id[1]}` : `AC${id[2]}`,
		description: description || label.replace(/^AC[\s-]?\d+\s*[—-]?\s*/i, "").trim(),
	};
}

function activeHint(stage: ResolvedFlowStage | null): FlowActivityHint | null {
	if (!stage?.activity) return null;
	return (
		stage.activity.design ??
		stage.activity.implement ??
		stage.activity.review ??
		stage.activity.diagnose ??
		stage.activity.gate ??
		null
	);
}

function commandMutates(command: string): boolean {
	return /\bletra\s+(?:ac\s+done|flow\s+move|focus|sitrep|health\s+(?:ack|dismiss|scan))\b/i.test(
		command,
	);
}

function resolveCommands(
	hint: FlowActivityHint | null,
	item: Item | null,
	pendingAC: AgentDirectionSnapshot["pendingAC"],
	nextStageId: string | null,
): AgentDirectionCommand[] {
	return (hint?.commands ?? []).flatMap((entry) => {
		let command = entry.command;
		if (command.includes("<AC-ID>")) {
			if (!pendingAC) return [];
			command = command.replaceAll("<AC-ID>", pendingAC.id);
		}
		if (command.includes("<ITEM-ID>")) {
			if (!item) return [];
			command = command.replaceAll("<ITEM-ID>", item.id);
		}
		if (command.includes("<NEXT-STAGE>")) {
			if (!nextStageId) return [];
			command = command.replaceAll("<NEXT-STAGE>", nextStageId);
		}
		return [
			{
				id: slug(entry.label || command),
				command,
				label: entry.label || command,
				mutates: commandMutates(command),
			},
		];
	});
}

function resolveActions(hint: FlowActivityHint | null): AgentDirectionAction[] {
	return (hint?.nextActions ?? []).map((action) => ({
		id: slug(action.label),
		label: action.label,
		reason: action.description,
	}));
}

function semanticRevision(
	snapshot: Omit<AgentDirectionSnapshot, "revision" | "generatedAt">,
): string {
	return `sha256:${createHash("sha256").update(JSON.stringify(snapshot)).digest("hex")}`;
}

export function createAgentDirectionSnapshot(
	input: CreateAgentDirectionSnapshotInput,
): AgentDirectionSnapshot {
	const workspaceResolution = resolveWorkspaceRoot(input.workspaceRoot);
	const invalidWorkspace = workspaceResolution.errorCode === "WORKSPACE_LINK_INVALID"
		? invalidWorkspaceDiagnostic(input.workspaceRoot)
		: null;
	if (invalidWorkspace) {
		const sanitized = {
			schemaVersion: "1" as const,
			source: {
				harnessVersion: null,
				flowId: null,
				workspaceRoot: workspaceResolution.workspaceRoot.replace(/\\/g, "/"),
				workspaceDir: workspaceResolution.workspaceDir.replace(/\\/g, "/"),
				locationPath: workspaceResolution.locationPath.replace(/\\/g, "/"),
				resolutionMode: workspaceResolution.type,
				workflowVersionId: null,
				workflowVersionNumber: null,
			},
			mode: "degraded" as const,
			workspace: invalidWorkspace,
			item: null,
			roleIds: [],
			allowedStageIds: [],
			objective: null,
			pendingAC: null,
			commands: [],
		operations: [],
		gates: [],
		references: [],
			prohibitions: [],
			requiredEvidence: [],
			nextActions: [],
			warnings: [{
				code: "WORKSPACE_LINK_INVALID" as const,
				message: `O .letra-link não aponta para um workspace canônico válido${workspaceResolution.errorMessage ? `: ${workspaceResolution.errorMessage}` : "."}`,
			}],
		};
		return {
			...sanitized,
			revision: semanticRevision(sanitized),
			generatedAt: input.now ?? new Date().toISOString(),
		};
	}
	const item = input.workflow ? findCurrentItem(input.workflow, input.currentItemId) : null;
	const stage = item
		? (input.flow?.stages.find((candidate) => candidate.id === item.stage) ?? null)
		: null;
	const sortedStages = input.flow ? [...input.flow.stages].sort((a, b) => a.order - b.order) : [];
	const stageIndex = stage
		? sortedStages.findIndex((candidate) => candidate.id === stage.id)
		: -1;
	const nextStageId = stageIndex >= 0 ? (sortedStages[stageIndex + 1]?.id ?? null) : null;
	const hint = activeHint(stage);
	const pendingAC = firstPendingAC(input.specContent);
	const warnings = (input.flow?.warnings ?? []).map((warning) => ({
		code: warning.code,
		message: warning.message,
	}));
	if (workspaceResolution.errorCode === "WORKSPACE_LINK_INVALID") {
		warnings.push({
			code: "WORKSPACE_LINK_INVALID",
			message: `O .letra-link não aponta para um workspace canônico válido${workspaceResolution.errorMessage ? `: ${workspaceResolution.errorMessage}` : "."}`,
		});
	}
	const mode: AgentDirectionSnapshot["mode"] = !input.workflow
		? workspaceResolution.errorCode ? "degraded" : "unconfigured"
		: !input.flow || (input.flow.source !== "workflow-template" && input.flow.source !== "workflow-version") || warnings.length > 0
			? "degraded"
			: "active";
	const allowedStageIds = [...new Set(stage?.roles.flatMap((role) => role.allowedStages) ?? [])];
	const gateEvidence = stage?.activity?.gate?.evidence;
	const operations = Object.entries(input.flow?.operations ?? {}).map(([id, operation]) => ({
		id,
		description: operation.description,
		requiredCapability: operation.requiredCapability,
		requiresClaim: operation.requiresClaim === true,
		allowedInStages: [...operation.allowedInStages],
		allowedActors: [...operation.allowedActors],
	}));
	const gates = [...new Map((input.flow?.stages ?? []).flatMap((flowStage) => flowStage.gate ? [[flowStage.gate.id, {
		id: flowStage.gate.id,
		name: flowStage.gate.name,
		type: flowStage.gate.type,
		blocking: flowStage.gate.blocking,
		policyRef: flowStage.gate.policyRef,
		checkType: flowStage.gate.checkType,
	}] as const] : []).map(([id, gate]) => [id, gate])).values()];

	// Constitution governance
	const constitutionPath = join(getLetraDir(input.workspaceRoot), "constitution.md");
	const constitutionAvailable = existsSync(constitutionPath);
	const constitutionVersion =
		input.constitutionVersion ??
		(constitutionAvailable ? readConstitutionVersion(input.workspaceRoot) : null);
	const governanceReferences: GovernanceReference[] = [];
	if (constitutionAvailable) {
		governanceReferences.push({
			path: "constitution.md",
			version: constitutionVersion ?? "unknown",
			available: true,
			source: "workspace",
		});
	} else {
		governanceReferences.push({
			path: "constitution.md",
			version: "unknown",
			available: false,
			source: "workspace",
		});
		warnings.push({
			code: "CONSTITUTION_MISSING",
			message: "Constitution file not found in workspace",
		});
	}
	const referenceCandidates = [
		...(item?.spec ? [{ path: `specs/${item.spec}/spec.md`, reason: "Acceptance criteria and task context" }] : []),
		...(hint?.mustRead ?? []).map((reference) => ({ path: reference.path, reason: reference.reason })),
		{ path: "constitution.md", reason: "Workspace governance" },
	];
	// The boundary resolves the data dir with realpath, which throws when it
	// does not exist yet (uninitialized workspace). That must leave every
	// reference unavailable, not crash the direction.
	const letraDir = getLetraDir(input.workspaceRoot);
	let boundary: ReturnType<typeof createWorkspaceBoundary> | null = null;
	try { boundary = createWorkspaceBoundary(letraDir); } catch { /* No data dir: references unavailable. */ }
	const references = [...new Map(referenceCandidates.map((reference) => {
		const safeRelativePath = reference.path.replace(/\\/g, "/");
		let absolutePath: string | null = null;
		try { absolutePath = boundary?.assertPath(join(letraDir, safeRelativePath)) ?? null; } catch { /* Invalid references remain unavailable. */ }
		const content = absolutePath && existsSync(absolutePath) ? readFileSync(absolutePath) : null;
		return [safeRelativePath, {
			id: slug(safeRelativePath),
			path: safeRelativePath,
			reason: reference.reason,
			sha256: content ? createHash("sha256").update(content).digest("hex") : null,
			available: content !== null,
		}] as const;
	})).values()];

	const semantic = {
		schemaVersion: "1" as const,
		source: {
			harnessVersion: input.flow?.harnessVersion ?? input.workflow?.harnessVersion ?? null,
			flowId: input.flow?.id ?? null,
			workspaceRoot: workspaceResolution.workspaceRoot.replace(/\\/g, "/"),
			workspaceDir: workspaceResolution.workspaceDir.replace(/\\/g, "/"),
			locationPath: workspaceResolution.locationPath.replace(/\\/g, "/"),
			resolutionMode: workspaceResolution.type,
			workflowVersionId: input.flow?.workflowVersionId ?? null,
			workflowVersionNumber: input.flow?.workflowVersionNumber ?? null,
		},
		mode,
		item: item
			? {
					id: item.id,
					description: item.description,
					stage: item.stage,
					spec: item.spec ?? null,
					workflowVersionId: item.workflowVersionId ?? input.flow?.workflowVersionId ?? null,
					workflowVersionNumber: item.workflowVersionNumber ?? input.flow?.workflowVersionNumber ?? null,
					claimedBy: item.claimedBy ?? null,
					claimedAt: item.claimedAt ?? null,
					claimExpiresAt: item.claimExpiresAt ?? null,
					claimExecutorId: item.claimExecutorId ?? null,
					claimCapability: item.claimCapability ?? null,
					claimRevision: item.claimRevision ?? null,
					claimTtlMinutes: item.claimTtlMinutes ?? null,
					activityStatus: item.activityStatus ?? null,
					activityStartedAt: item.activityStartedAt ?? null,
					lastHeartbeatAt: item.lastHeartbeatAt ?? null,
					lastFailure: item.lastFailure ?? null,
					validation: item.validation ?? null,
				}
			: null,
		roleIds: stage ? [...stage.roleIds] : [],
		allowedStageIds,
		objective: hint?.objective ?? null,
		pendingAC,
		commands: resolveCommands(hint, item, pendingAC, nextStageId),
		operations,
		gates,
		references,
		prohibitions: [...(hint?.mustNotDo ?? [])],
		requiredEvidence: gateEvidence ? [gateEvidence] : [],
		nextActions: resolveActions(hint),
		warnings,
		governanceReferences,
		constitutionVersion: constitutionVersion ?? undefined,
	};
	return {
		...semantic,
		revision: semanticRevision(semantic),
		generatedAt: input.now ?? new Date().toISOString(),
	};
}

function readActiveSpec(root: string, specName: string | null): string | null {
	if (!specName) return null;
	const workspace = resolveWorkspaceRoot(root);
	const specCandidates = [
		join(workspace.dataDir, "specs", specName),
		join(workspace.workspaceRoot, "specs", specName),
		join(getLetraDir(root), "specs", specName),
	];
	const specDir = specCandidates.find((candidate) =>
		existsSync(join(candidate, "spec.md")) || existsSync(join(candidate, "acceptance.md")),
	) ?? specCandidates[0]!;
	const acceptancePath = join(specDir, "acceptance.md");
	const specPath = join(specDir, "spec.md");
	// spec.md is the canonical narrative and is where request_rework appends
	// new criteria. acceptance.md is a projection kept for tools that need a
	// compact checklist. Reading the projection first made a valid rework look
	// like it had no pending AC whenever a legacy acceptance.md was stale.
	const spec = existsSync(specPath) ? readFileSync(specPath, "utf-8") : null;
	const acceptance = existsSync(acceptancePath) ? readFileSync(acceptancePath, "utf-8") : null;
	return [spec, acceptance].filter((content): content is string => content !== null).join("\n") || null;
}

function readConstitutionVersion(root: string): string | null {
	const constitutionPath = join(getLetraDir(root), "constitution.md");
	if (!existsSync(constitutionPath)) return null;
	const content = readFileSync(constitutionPath, "utf-8");
	const versionMatch = content.match(/\*\*Version:\*\*\s*(.+)/);
	return versionMatch ? versionMatch[1].trim() : null;
}

function resolveAgentDirectionUnderLock(
	root: string,
	currentItemId?: string | null,
	options: { runId?: string | null; workflowVersionId?: string | null } = {},
): AgentDirectionSnapshot {
	const selectedRun = options.runId
		? readExecutionRuns(root).runs.find((run) => run.id === options.runId) ?? null
		: null;
	if (options.runId && !selectedRun) throw new Error(`RUN_NOT_FOUND: ${options.runId}`);
	if (selectedRun && selectedRun.workspaceId !== resolveWorkspaceRoot(root).workspaceRoot) {
		throw new Error(`RUN_WORKSPACE_MISMATCH: ${options.runId}`);
	}
	const initialWorkflow = loadWorkflow(root);
	const selectedItem =
		(selectedRun ? initialWorkflow?.items?.find((item) => item.id === selectedRun.itemId) : null) ??
		(currentItemId ? initialWorkflow?.items?.find((item) => item.id === currentItemId) : null) ?? null;
	if (selectedRun && !selectedItem) throw new Error(`RUN_ITEM_NOT_FOUND: ${selectedRun.itemId}`);

	const resolution = resolveActiveFlowFor(root, initialWorkflow, {
		itemId: selectedItem?.id,
		workflowVersionId: selectedRun?.workflowVersionId ?? options.workflowVersionId ?? selectedItem?.workflowVersionId,
	});
	const workflow = resolution.workflow;
	const activeItem =
		(selectedItem ? workflow?.items.find((item) => item.id === selectedItem.id) : null) ??
		null;
	if (selectedRun && activeItem && selectedRun.workflowStageId) activeItem.stage = selectedRun.workflowStageId;
	const specName = activeItem?.spec ?? null;
	const snapshot = createAgentDirectionSnapshot({
		workspaceRoot: root,
		workflow,
		flow: resolution.flow,
		specContent: readActiveSpec(root, specName),
		currentItemId: activeItem?.id ?? null,
	});
	if (!selectedRun) return snapshot;
	const semantic = {
		schemaVersion: snapshot.schemaVersion,
		source: snapshot.source,
		mode: snapshot.mode,
		run: {
			id: selectedRun.id,
			itemId: selectedRun.itemId,
			executorId: selectedRun.binding.executorId,
			workflowVersionId: selectedRun.workflowVersionId,
			status: selectedRun.status,
		},
		item: snapshot.item,
		roleIds: snapshot.roleIds,
		allowedStageIds: snapshot.allowedStageIds,
		objective: snapshot.objective,
		pendingAC: snapshot.pendingAC,
		commands: snapshot.commands,
		operations: snapshot.operations,
		gates: snapshot.gates,
		references: snapshot.references,
		prohibitions: snapshot.prohibitions,
		requiredEvidence: snapshot.requiredEvidence,
		nextActions: snapshot.nextActions,
		warnings: snapshot.warnings,
		governanceReferences: snapshot.governanceReferences,
		constitutionVersion: snapshot.constitutionVersion,
	};
	return {
		...snapshot,
		run: semantic.run,
		revision: semanticRevision(semantic),
	};
}

/** Read workflow, Run and spec projections under one workspace lock to avoid mixed snapshots during passage commits. */
export function resolveAgentDirection(
	root: string,
	currentItemId?: string | null,
	options: { runId?: string | null; workflowVersionId?: string | null } = {},
): AgentDirectionSnapshot {
	return withWorkspaceTransactionLockSync(root, () => resolveAgentDirectionUnderLock(root, currentItemId, options));
}

/** Resolve a read direction from durable Runs without selecting an arbitrary item. */
function resolveDirectionUnderLock(root: string, options: ResolveDirectionOptions = {}): AgentDirectionSnapshot {
	const runs = readExecutionRuns(root).runs.filter((run) => {
		if (!isRunActiveForDirection(run)) return false;
		return !options.executorId || run.binding.executorId === options.executorId;
	});
	if (options.runId) {
		const allRuns = readExecutionRuns(root).runs;
		const selected = runs.find((run) => run.id === options.runId);
		if (!selected) {
			const existing = allRuns.find((run) => run.id === options.runId);
			if (!existing) throw new Error(`RUN_NOT_FOUND: ${options.runId}`);
			if (options.executorId && existing.binding.executorId !== options.executorId) {
				throw new Error(`RUN_UNAUTHORIZED: executor is not bound to ${options.runId}`);
			}
			throw new Error(`RUN_INACTIVE: ${options.runId}`);
		}
		return withAssignment(resolveAgentDirection(root, undefined, { runId: selected.id }), {
			status: "assigned",
			runId: selected.id,
		});
	}
	if (options.itemId) {
		// An item with an active Run is worked through that Run: `--item` must
		// return the same direction the operations compare (ITEM-39).
		const itemRuns = runs.filter((run) => run.itemId === options.itemId);
		if (itemRuns.length === 1 && !options.workflowVersionId) {
			return withAssignment(resolveAgentDirection(root, undefined, { runId: itemRuns[0]!.id }), {
				status: "assigned",
				runId: itemRuns[0]!.id,
			});
		}
		const selectedItem = resolveAgentDirection(root, options.itemId, { workflowVersionId: options.workflowVersionId });
		if (!selectedItem.item) throw new Error(`ITEM_NOT_FOUND: ${options.itemId}`);
		return selectedItem;
	}
	if (runs.length === 1) {
		return withAssignment(resolveAgentDirection(root, undefined, { runId: runs[0]!.id }), {
			status: "assigned",
			runId: runs[0]!.id,
		});
	}
	const unassigned = resolveAgentDirectionUnderLock(root);
	return withAssignment(unassigned, runs.length === 0
		? { status: "unassigned" }
		: { status: "selection-required", candidateRunIds: runs.map((run) => run.id).sort() });
}

/** Select and resolve a Run from the same locked snapshot. */
export function resolveDirection(root: string, options: ResolveDirectionOptions = {}): AgentDirectionSnapshot {
	return withWorkspaceTransactionLockSync(root, () => resolveDirectionUnderLock(root, options));
}

/**
 * The assigned view of a Run direction, as resolveOperationDirection returns
 * it. For operations that must predict their post-write direction inside a
 * transaction (e.g. the passage), so the predicted afterRevision is the one
 * the next operation compares.
 */
export function withRunAssignment(snapshot: AgentDirectionSnapshot, runId: string): AgentDirectionSnapshot {
	return withAssignment(snapshot, { status: "assigned", runId });
}

export interface OperationDirectionTarget {
	itemId?: string;
	runId?: string;
}

/**
 * The single direction every operation compares and returns (ITEM-39).
 *
 * - An active Run (explicit, or the item's only active Run) yields the
 *   assigned Run direction: what the claim returns and `letra direction
 *   --run`/`--item` show.
 * - An item without an active Run yields the item direction.
 * - No target yields the workspace direction.
 *
 * The executor is deliberately not part of the revision: whether an executor
 * may act is an authorization check, not a different view of the state.
 */
export function resolveOperationDirection(root: string, target: OperationDirectionTarget = {}): AgentDirectionSnapshot {
	return withWorkspaceTransactionLockSync(root, () => {
		const runs = readExecutionRuns(root).runs;
		if (target.runId) {
			const run = runs.find((candidate) => candidate.id === target.runId);
			if (run && isRunActiveForDirection(run)) {
				return withAssignment(resolveAgentDirection(root, undefined, { runId: run.id }), { status: "assigned", runId: run.id });
			}
			if (run) return resolveAgentDirection(root, undefined, { runId: run.id });
			// An explicit Run that does not exist is an error, never a silent
			// fallback to another scope.
			throw new Error(`RUN_NOT_FOUND: ${target.runId}`);
		}
		if (target.itemId) {
			const active = runs.filter((run) => run.itemId === target.itemId && isRunActiveForDirection(run));
			if (active.length === 1) {
				return withAssignment(resolveAgentDirection(root, undefined, { runId: active[0]!.id }), { status: "assigned", runId: active[0]!.id });
			}
			return resolveAgentDirection(root, target.itemId);
		}
		return resolveAgentDirection(root, null);
	});
}

function withAssignment(
	snapshot: AgentDirectionSnapshot,
	assignment: NonNullable<AgentDirectionSnapshot["assignment"]>,
): AgentDirectionSnapshot {
	const semantic = { ...snapshot, assignment };
	delete (semantic as Partial<AgentDirectionSnapshot>).revision;
	delete (semantic as Partial<AgentDirectionSnapshot>).generatedAt;
	return {
		...snapshot,
		assignment,
		revision: semanticRevision(semantic as Omit<AgentDirectionSnapshot, "revision" | "generatedAt">),
	};
}
