import { existsSync, readFileSync, renameSync, writeFileSync, realpathSync, statSync, mkdirSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import type { AgentDirectionSnapshot, AgentRegistry } from "@letra/types";
import type { Item, Workflow } from "../commands/flow-init.js";
import { resolveAgentDirection } from "../agent-direction/service.js";
import { generateAdapters } from "../adapters/generate.js";
import { writeFocusWithRecommendations } from "../adapters/focus-recommendations.js";
import { loadWorkflow, writeWorkflow } from "../commands/flow-init.js";
import { validate, type ValidationSummary } from "../commands/validate.js";
import { resolveActiveFlow } from "../flow-definition/resolve.js";
import { loadHarness, resolveHarnessRoot, DEFAULT_HARNESS_VERSION } from "../harness/loader.js";
import { createWorkspaceBoundary } from "../security/workspace-boundary.js";
import { resolveExecutionWorkspace } from "../orchestrator/execution-workspace.js";
import { logEntry, type LogAction } from "../session-log.js";
import { GateChecker } from "../harness/gate-checker.js";
import { getLetraDir, resolveWorkspaceRoot } from "../workspace/resolver.js";
import { assertOperationLevel } from "../identity/guard.js";
import { invalidWorkspaceDiagnostic, type WorkspaceIntegrityDiagnostic } from "../workspace/integrity.js";
import { captureSecurityBaseline, runScopedSecurityReview, resolveSecurityExecutionRoot, securityReportPath, type SecurityReviewReport } from "../security/scoped-review.js";
import { loadAgents } from "../agents/service.js";

/**
 * Resolves actor from MCP format (e.g., "mcp:opencode") to role ID (e.g., "implementer")
 * using the runtimeBindings from agents.json.
 */
function resolveMcpActor(workspaceRoot: string, actor: string, stageId: string): string {
	// Only resolve MCP actors
	if (!actor.startsWith("mcp:")) return actor;

	// Extract executor name from "mcp:opencode" -> "opencode"
	const executorName = actor.slice(4);
	if (!executorName) return actor;

	try {
		const registry = loadAgents(workspaceRoot);
		const runtimeBindings = registry.runtimeBindings ?? [];

		// Find binding that matches executorId and stageId
		const binding = runtimeBindings.find(
			(b) => b.executorId === executorName && b.stageIds.includes(stageId)
		);

		if (binding?.roleId) {
			return binding.roleId;
		}
	} catch {
		// If we can't load the registry, return the original actor
	}

	return actor;
}

export type OperationOutcome = "accepted" | "rejected" | "approval-required";

export interface OperationResult {
	outcome: OperationOutcome;
	auditId: string;
	beforeRevision: string;
	afterRevision: string;
	reasonCode: string;
	reason: string;
	nextDirection: AgentDirectionSnapshot;
	validation?: ValidationSummary;
	workspace?: WorkspaceIntegrityDiagnostic;
	securityReview?: SecurityReviewReport;
}

interface OperationContext {
	expectedRevision: string;
	reason: string;
	actor?: string;
	idempotencyKey?: string;
}

export interface CompleteAcInput extends OperationContext {
	acId: string;
	evidence: string[];
	executorId?: string;
}

export interface RequestTransitionInput extends OperationContext {
	itemId: string;
	targetStageId: string;
	/** Explicit human override for administrative transitions with pending ACs. */
	force?: boolean;
}

export interface ClaimOperationInput extends OperationContext {
	itemId: string;
	executorId: string;
	capability: string;
	ttlMinutes?: number;
}

export interface ExecutionEventInput extends OperationContext {
	itemId: string;
	executorId: string;
	status: "started" | "heartbeat" | "succeeded" | "failed";
	message?: string;
	recovery?: "retry" | "release" | "handoff" | "human";
	errorCode?: string;
}

export interface EvidenceInput extends OperationContext {
	itemId: string;
	executorId: string;
	evidence: Array<{ kind: "diff" | "file" | "command" | "test" | "artifact"; value: string; source: string; observedAt?: string; sha256?: string; exitCode?: number }>;
}
export interface SecurityReviewInput extends OperationContext {
	itemId: string;
	executorId: string;
}
export interface HandoffEvidence {
	kind: "diff" | "file" | "command" | "test" | "artifact";
	value: string;
	source: string;
	observedAt?: string;
	sha256?: string;
}
export interface HandoffInput extends OperationContext {
	itemId: string; to: string; summary: string; evidence: Array<string | HandoffEvidence>; executorId: string; ttlMinutes?: number;
}

export interface GateDecisionInput extends OperationContext {
	itemId: string;
	decision: "approve" | "request-changes" | "reject";
}

/** A reviewer sends an item back with explicit, durable acceptance criteria. */
export interface RequestReworkInput extends OperationContext {
	itemId: string;
	acceptanceCriteria: Array<{ id?: string; description: string }>;
}

export interface ReleaseClaimInput extends OperationContext {
	itemId: string;
}

export interface RollbackHandoffInput extends OperationContext {
	itemId: string;
}

/** A human starts work from Backlog; the first agent receives a durable handoff. */
export interface ActivateWorkInput extends OperationContext {
	itemId: string;
}

export interface CreateItemInput extends OperationContext {
	id: string;
	description: string;
	stage: string;
}
export interface UpdateItemInput extends OperationContext {
	itemId: string;
	description?: string;
	tasks?: Array<{ id: string; description: string; done: boolean }>;
}
export interface DeleteItemInput extends OperationContext { itemId: string; }
export interface ReclaimExpiredClaimsInput extends OperationContext { actor: string; }

export const ACTIVE_HEARTBEAT_WINDOW_MS = 90_000;
export function hasLiveClaim(item: Partial<Pick<Item, "claimedBy" | "claimExpiresAt" | "activityStatus" | "lastHeartbeatAt">> | null | undefined, now = Date.now()): boolean {
	if (!item?.claimedBy || (item.activityStatus !== "started" && item.activityStatus !== "heartbeat")) return false;
	const expires = item.claimExpiresAt ? Date.parse(item.claimExpiresAt) : Number.NaN;
	const heartbeat = item.lastHeartbeatAt ? Date.parse(item.lastHeartbeatAt) : Number.NaN;
	return Number.isFinite(expires) && expires > now && Number.isFinite(heartbeat) && heartbeat <= now && now - heartbeat <= ACTIVE_HEARTBEAT_WINDOW_MS;
}
function evidenceKind(value: string): "file" | "command" {
	const absolute = /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\");
	const traversal = /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value);
	// Commands commonly contain package paths. Treat a slash as a file only
	// when the value is path-shaped (no whitespace), or is absolute/traversal.
	return absolute || traversal || (value.includes("/") && !/\s/.test(value)) ? "file" : "command";
}

interface IdempotencyRecord { fingerprint: string; result: OperationResult; }
function idempotencyPath(root: string): string { return join(getLetraDir(root), "operations", "idempotency.json"); }
function inputFingerprint(input: OperationContext): string {
	return createHash("sha256").update(JSON.stringify(input, Object.keys(input).sort())).digest("hex");
}
function replayIdempotent(root: string, input: OperationContext): OperationResult | null {
	if (!input.idempotencyKey?.trim()) return null;
	try {
		const records = JSON.parse(readFileSync(idempotencyPath(root), "utf8")) as Record<string, IdempotencyRecord>;
		const record = records[input.idempotencyKey];
		if (!record) return null;
		if (record.fingerprint !== inputFingerprint(input)) return rejected(root, resolveAgentDirection(root), "IDEMPOTENCY_KEY_CONFLICT", "A chave idempotente já foi usada por outra operação.", input, { operation: "idempotency" });
		return record.result;
	} catch { return null; }
}
function rememberIdempotent(root: string, input: OperationContext, value: OperationResult): OperationResult {
	if (!input.idempotencyKey?.trim()) return value;
	const file = idempotencyPath(root);
	let records: Record<string, IdempotencyRecord> = {};
	try { records = JSON.parse(readFileSync(file, "utf8")) as Record<string, IdempotencyRecord>; } catch { /* first operation */ }
	records[input.idempotencyKey] = { fingerprint: inputFingerprint(input), result: value };
	const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
	mkdirSync(join(getLetraDir(root), "operations"), { recursive: true });
	writeFileSync(temp, JSON.stringify(records, null, 2), "utf8");
	renameSync(temp, file);
	return value;
}

export function activityOperation(root: string, itemId?: string): AgentDirectionSnapshot["item"] {
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const direction = resolveAgentDirection(workspaceRoot);
	if (!itemId) return direction.item;
	const workflow = loadWorkflow(workspaceRoot);
	const item = workflow?.items.find((candidate) => candidate.id === itemId);
	return item ? ({ ...item, spec: item.spec ?? null } as AgentDirectionSnapshot["item"]) : null;
}

export async function createItemOperation(root: string, input: CreateItemInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { operation: "create_item" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot); const subject = { operation: "create_item" };
	const stale = checkRevision(workspaceRoot, before, input, subject); if (stale) return stale;
	if (!input.actor?.trim()) return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Criação de item exige identidade do actor.", input, subject);
	const workflow = loadWorkflow(workspaceRoot);
	if (!workflow) return rejected(workspaceRoot, before, "WORKFLOW_NOT_FOUND", "Workflow não encontrado.", input, subject);
	if (workflow.items.some((item) => item.id === input.id)) return rejected(workspaceRoot, before, "ITEM_EXISTS", "Já existe um item com este identificador.", input, subject);
	if (!workflow.stages.some((stage) => stage.id === input.stage)) return rejected(workspaceRoot, before, "STAGE_NOT_FOUND", "Estágio não encontrado no harness.", input, subject);
	const item: Item = { id: input.id, description: input.description, stage: input.stage, createdAt: new Date().toISOString(), tasks: [] };
	workflow.items.push(item); workflow.updatedAt = new Date().toISOString();
	const write = await writeWorkflow(workspaceRoot, { workflow, source: "web-ui", primaryItemId: item.id, skipSitrep: true, quiet: true, expectedRevision: before.revision });
	if (!write.ok) return rejected(workspaceRoot, before, write.error?.startsWith("DIRECTION_STALE") ? "DIRECTION_STALE" : "ITEM_WRITE_FAILED", write.error ?? "Falha ao criar item.", input, subject);
	const after = resolveAgentDirection(workspaceRoot); const entry = audit(workspaceRoot, "item_move", before, { outcome: "accepted", reasonCode: "ITEM_CREATED", reason: input.reason, actor: input.actor, itemId: item.id });
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "ITEM_CREATED", input.reason, after));
}

export async function updateItemOperation(root: string, input: UpdateItemInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "update_item" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot); const subject = { itemId: input.itemId, operation: "update_item" };
	const stale = checkRevision(workspaceRoot, before, input, subject); if (stale) return stale;
	if (!input.actor?.trim()) return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Alteração de item exige identidade do actor.", input, subject);
	const workflow = loadWorkflow(workspaceRoot); const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	if (!workflow || !item) return rejected(workspaceRoot, before, "ITEM_NOT_FOUND", "Item não encontrado.", input, subject);
	if (input.description !== undefined) item.description = input.description;
	if (input.tasks !== undefined) item.tasks = input.tasks;
	workflow.updatedAt = new Date().toISOString();
	const write = await writeWorkflow(workspaceRoot, { workflow, source: "web-ui", primaryItemId: item.id, skipSitrep: true, quiet: true, expectedRevision: before.revision });
	if (!write.ok) return rejected(workspaceRoot, before, write.error?.startsWith("DIRECTION_STALE") ? "DIRECTION_STALE" : "ITEM_WRITE_FAILED", write.error ?? "Falha ao atualizar item.", input, subject);
	const after = resolveAgentDirection(workspaceRoot); const entry = audit(workspaceRoot, "item_move", before, { outcome: "accepted", reasonCode: "ITEM_UPDATED", reason: input.reason, actor: input.actor, itemId: item.id });
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "ITEM_UPDATED", input.reason, after));
}

export async function deleteItemOperation(root: string, input: DeleteItemInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "delete_item" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot); const subject = { itemId: input.itemId, operation: "delete_item" };
	const stale = checkRevision(workspaceRoot, before, input, subject); if (stale) return stale;
	if (!input.actor?.trim()) return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Remoção de item exige identidade do actor.", input, subject);
	const workflow = loadWorkflow(workspaceRoot); const index = workflow?.items.findIndex((candidate) => candidate.id === input.itemId) ?? -1;
	if (!workflow || index < 0) return rejected(workspaceRoot, before, "ITEM_NOT_FOUND", "Item não encontrado.", input, subject);
	workflow.items.splice(index, 1); workflow.updatedAt = new Date().toISOString();
	const write = await writeWorkflow(workspaceRoot, { workflow, source: "web-ui", skipSitrep: true, quiet: true, expectedRevision: before.revision });
	if (!write.ok) return rejected(workspaceRoot, before, write.error?.startsWith("DIRECTION_STALE") ? "DIRECTION_STALE" : "ITEM_WRITE_FAILED", write.error ?? "Falha ao remover item.", input, subject);
	const after = resolveAgentDirection(workspaceRoot); const entry = audit(workspaceRoot, "item_move", before, { outcome: "accepted", reasonCode: "ITEM_DELETED", reason: input.reason, actor: input.actor, itemId: input.itemId });
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "ITEM_DELETED", input.reason, after));
}

export async function submitEvidenceOperation(root: string, input: EvidenceInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "submit_evidence" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot); const subject = { itemId: input.itemId, operation: "submit_evidence" };
	const stale = checkRevision(workspaceRoot, before, input, subject); if (stale) return stale;
	const item = loadWorkflow(workspaceRoot)?.items.find((candidate) => candidate.id === input.itemId);
	const resolvedEvidenceActor = resolveMcpActor(workspaceRoot, (input.actor ?? "").trim(), item?.stage ?? "");
	const evidenceExpired = !item?.claimExpiresAt || !Number.isFinite(Date.parse(item.claimExpiresAt)) || Date.now() >= Date.parse(item.claimExpiresAt);
	if (!item || item.claimedBy !== resolvedEvidenceActor || item.claimExecutorId !== input.executorId || evidenceExpired) return rejected(workspaceRoot, before, evidenceExpired ? "CLAIM_EXPIRED" : "CLAIM_REQUIRED", "A evidência exige claim vigente, com actor, executor e lease válido.", input, subject);
	const boundary = createWorkspaceBoundary(resolveWorkspaceRoot(root).workspaceDir);
	for (const evidence of input.evidence) {
		if (!evidence.source?.trim() || !evidence.value?.trim()) return rejected(workspaceRoot, before, "EVIDENCE_INVALID", "Evidência exige origem e valor.", input, subject);
		if (evidence.kind === "file" || evidence.kind === "diff" || evidence.kind === "artifact") {
			try { const path = boundary.assertPath(evidence.value); if (existsSync(path) && statSync(path).isSymbolicLink()) throw new Error("symlink"); }
			catch { return rejected(workspaceRoot, before, "EVIDENCE_PATH_OUTSIDE_WORKSPACE", "Path da evidência fora do workspace autorizado.", input, subject); }
		}
	}
	const entry = audit(workspaceRoot, "agent_execution_event", before, { outcome: "accepted", reasonCode: "EVIDENCE_ACCEPTED", reason: input.reason, actor: input.actor, itemId: input.itemId, details: { evidence: input.evidence.map((e) => ({ ...e, observedAt: e.observedAt ?? new Date().toISOString(), sha256: e.sha256 ?? createHash("sha256").update(e.value).digest("hex") })) } });
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "EVIDENCE_ACCEPTED", input.reason, resolveAgentDirection(workspaceRoot)));
}

export async function requestHandoffOperation(root: string, input: HandoffInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "request_handoff" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root; const before = resolveAgentDirection(workspaceRoot); const subject = { itemId: input.itemId, operation: "request_handoff" };
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const stale = checkRevision(workspaceRoot, before, input, subject); if (stale) return stale;
	const evidenceBoundary = createWorkspaceBoundary(resolveWorkspaceRoot(root).workspaceDir);
	const normalizedEvidence: string[] = [];
	const structuredEvidence: HandoffEvidence[] = [];
	for (const evidence of input.evidence ?? []) {
		const value = typeof evidence === "string" ? evidence.trim() : evidence.value?.trim();
		if (!value) return rejected(workspaceRoot, before, "EVIDENCE_INVALID", "Handoff exige evidências com valor não vazio.", input, subject);
		const kind = typeof evidence === "string" ? evidenceKind(value) : evidence.kind;
		const source = typeof evidence === "string" ? "handoff" : evidence.source?.trim();
		if (!source) return rejected(workspaceRoot, before, "EVIDENCE_INVALID", "Handoff exige origem da evidência.", input, subject);
		if (kind === "file" || kind === "diff" || kind === "artifact") {
			try {
				const path = evidenceBoundary.assertPath(value);
				if (existsSync(path) && statSync(path).isSymbolicLink()) throw new Error("symlink");
			} catch {
				return rejected(workspaceRoot, before, "EVIDENCE_PATH_OUTSIDE_WORKSPACE", "Path da evidência do handoff fora do workspace autorizado.", input, subject);
			}
		}
		normalizedEvidence.push(value);
		structuredEvidence.push(typeof evidence === "string"
			? { kind, value, source, observedAt: new Date().toISOString(), sha256: createHash("sha256").update(value).digest("hex") }
			: { ...evidence, kind, value, source, observedAt: evidence.observedAt ?? new Date().toISOString(), sha256: evidence.sha256 ?? createHash("sha256").update(value).digest("hex") });
	}
	const workflow = loadWorkflow(workspaceRoot); const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	const resolvedActor = resolveMcpActor(workspaceRoot, (input.actor ?? "").trim(), item?.stage ?? "");
	if (!workflow || !item || item.claimedBy !== resolvedActor || item.claimExecutorId !== input.executorId) return rejected(workspaceRoot, before, "CLAIM_REQUIRED", "Handoff exige claim vigente do executor.", input, subject);
	if (!item.claimExpiresAt || !Number.isFinite(Date.parse(item.claimExpiresAt)) || Date.now() >= Date.parse(item.claimExpiresAt)) return rejected(workspaceRoot, before, "CLAIM_EXPIRED", "Handoff exige lease vigente; faça heartbeat ou novo claim.", input, subject);
	const replacingExpiredHandoff = Boolean(
		item.handoff && Number.isFinite(Date.parse(item.handoff.expiresAt)) && Date.parse(item.handoff.expiresAt) <= Date.now(),
	);
	// Allow overwriting if: handoff expired, same executor, or same target actor
	const canOverwriteHandoff = !item.handoff || replacingExpiredHandoff ||
		item.handoff.executorId === input.executorId ||
		item.handoff.to === resolvedActor;
	if (!canOverwriteHandoff) {
		return rejected(workspaceRoot, before, "HANDOFF_CONFLICT", "Já existe handoff pendente.", input, subject);
	}
	const activeFlow = resolveActiveFlow(workspaceRoot).flow;
	const stage = activeFlow?.stages.find((candidate) => candidate.id === item.stage);
	if (stage?.gate?.blocking) {
		const gateResult = new GateChecker(workspaceRoot).checkHandoffAllowed(stage.gate.id, item);
		const stageActors = stage.agents ?? [];
		const isEntryHandoff = stageActors.includes(input.to) && !stageActors.includes(resolvedActor);
		if (!gateResult.allowed) {
			const isHumanApprovalRequest =
				stage.gate.type === "human" &&
				(input.to === "human" || input.to.startsWith("human:"));
			if (isHumanApprovalRequest || isEntryHandoff) {
				// A handoff to the human is the approval request itself. The gate
				// remains pending and the decision operation will release the item.
				// Likewise, handing the item to the actor that owns the current
				// stage is an entry operation; the stage gate protects its exit.
			} else {
			const reason = gateResult.reason ?? `O gate "${stage.gate.name}" deve ser satisfeito antes do handoff.`;
			const outcome = stage.gate.type === "human" ? "approval-required" : "rejected";
			const reasonCode = stage.gate.type === "human"
				? "HUMAN_APPROVAL_REQUIRED"
				: (gateResult.reasonCode ?? "BLOCKING_GATE");
			const entry = audit(workspaceRoot, "agent_transition_requested", before, {
				outcome,
				reasonCode,
				reason,
				actor: input.actor,
				itemId: item.id,
				details: { gateId: stage.gate.id, to: input.to },
			});
			return result(before, entry.id, outcome, reasonCode, reason, before);
			}
		}
	}
	const now = new Date(); item.handoff = { from: input.actor ?? "unknown", to: input.to, summary: input.summary, evidence: normalizedEvidence, timestamp: now.toISOString(), expiresAt: new Date(now.getTime() + (input.ttlMinutes ?? 30) * 60000).toISOString(), executorId: input.executorId };
	item.claimedBy = undefined; item.claimedAt = undefined; item.claimExecutorId = undefined; item.claimCapability = undefined; item.claimRevision = undefined; item.claimExpiresAt = undefined; item.claimTtlMinutes = undefined; workflow.updatedAt = now.toISOString();
	const write = await writeWorkflow(workspaceRoot, { workflow, source: "flow-handoff", primaryItemId: item.id, skipSitrep: true, skipLog: true, quiet: true, confineAdapterWrites: true, expectedRevision: before.revision }); if (!write.ok) return rejected(workspaceRoot, before, write.error?.startsWith("DIRECTION_STALE") ? "DIRECTION_STALE" : "HANDOFF_WRITE_FAILED", write.error ?? "Falha ao persistir handoff.", input, subject);
	const entry = audit(workspaceRoot, "agent_execution_event", before, { outcome: "accepted", reasonCode: "HANDOFF_ACCEPTED", reason: input.reason, actor: input.actor, itemId: item.id, details: { to: input.to, executorId: input.executorId, replacedExpiredHandoff: replacingExpiredHandoff, evidence: structuredEvidence } }); return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "HANDOFF_ACCEPTED", input.reason, resolveAgentDirection(workspaceRoot)));
}

function audit(
	root: string,
	action: LogAction,
	direction: AgentDirectionSnapshot,
	input: {
		outcome: OperationOutcome;
		reasonCode: string;
		reason: string;
		actor?: string;
		itemId?: string;
		acId?: string;
		details?: Record<string, unknown>;
	},
) {
	return logEntry(root, action, input.reason, {
		itemId: input.itemId,
		acId: input.acId,
		details: {
			adapter: "codex",
			by: input.actor ?? "agent:codex",
			revision: direction.revision,
			outcome: input.outcome,
			reasonCode: input.reasonCode,
			...input.details,
		},
	});
}

function result(
	direction: AgentDirectionSnapshot,
	entryId: string,
	outcome: OperationOutcome,
	reasonCode: string,
	reason: string,
	nextDirection = direction,
	extra: Pick<OperationResult, "validation" | "workspace" | "securityReview"> = {},
): OperationResult {
	return {
		outcome,
		auditId: entryId,
		beforeRevision: direction.revision,
		afterRevision: nextDirection.revision,
		reasonCode,
		reason,
		nextDirection,
		...extra,
	};
}

function rejected(
	root: string,
	direction: AgentDirectionSnapshot,
	reasonCode: string,
	reason: string,
	context: OperationContext,
	subject: { itemId?: string; acId?: string; operation: string },
): OperationResult {
	const workspace = invalidWorkspaceDiagnostic(root);
	if (workspace) {
		return result(
			direction,
			"audit-unavailable:workspace-link-invalid",
			"rejected",
			"WORKSPACE_LINK_INVALID",
			"O .letra-link não aponta para um workspace canônico válido; nenhuma operação foi executada.",
			direction,
			{ workspace },
		);
	}
	const entry = audit(root, "agent_operation_rejected", direction, {
		outcome: "rejected",
		reasonCode,
		reason,
		actor: context.actor,
		itemId: subject.itemId,
		acId: subject.acId,
		details: { operation: subject.operation },
	});
	return result(direction, entry.id, "rejected", reasonCode, reason);
}

/**
 * Every mutating operation must fail closed before replay, workflow loading or
 * any write when the caller is inside a project with a broken .letra-link.
 * Keeping this check in the operation gateway gives CLI, HTTP and MCP the
 * same diagnostic envelope and prevents a local projection from becoming an
 * accidental second authority.
 */
function guardInvalidWorkspace(
	root: string,
	context: OperationContext,
	subject: { itemId?: string; acId?: string; operation: string },
): OperationResult | null {
	const workspace = invalidWorkspaceDiagnostic(root);
	if (!workspace) return null;
	const direction = resolveAgentDirection(root);
	return result(
		direction,
		"audit-unavailable:workspace-link-invalid",
		"rejected",
		"WORKSPACE_LINK_INVALID",
		"O .letra-link não aponta para um workspace canônico válido; nenhuma operação foi executada.",
		direction,
		{ workspace },
	);
}

function checkRevision(
	root: string,
	direction: AgentDirectionSnapshot,
	context: OperationContext,
	subject: { itemId?: string; acId?: string; operation: string },
): OperationResult | null {
	if (context.expectedRevision === direction.revision) return null;
	return rejected(
		root,
		direction,
		"DIRECTION_STALE",
		"A direção mudou desde a última consulta. Consulte get_direction e tente novamente.",
		context,
		subject,
	);
}

function normalizeAcId(value: string): string {
	const match = value.trim().match(/^AC[\s-]?(\d+(?:\.\d+)*)$/i);
	return match ? `AC${match[1]}` : value.trim().toUpperCase();
}

function resolveDecisionTargetStage(stages: Array<{ id: string }>, current: string, target: string): string | null {
	const index = stages.findIndex((stage) => stage.id === current);
	if (index < 0) return null;
	if (target === "next") return stages[index + 1]?.id ?? null;
	if (target === "previous") return stages[index - 1]?.id ?? null;
	if (target === "first") return stages[0]?.id ?? null;
	return stages.some((stage) => stage.id === target) ? target : null;
}

export async function claimOperation(
	root: string,
	input: ClaimOperationInput,
): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "claim" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: "claim" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.trim())
		return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Claim exige identidade do actor.", input, subject);
	const workflow = loadWorkflow(workspaceRoot);
	const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	if (!workflow || !item) return rejected(workspaceRoot, before, "ITEM_NOT_FOUND", "Item não encontrado.", input, subject);
	const flow = resolveActiveFlow(workspaceRoot, {
		itemId: item.id,
		workflowVersionId: item.workflowVersionId,
	}).flow;
	const stage = flow?.stages.find((candidate) => candidate.id === item.stage);
	if (stage?.zone === "done")
		return rejected(workspaceRoot, before, "ITEM_COMPLETED", "Cannot claim a completed item.", input, subject);
	if (!before.item || before.item.id !== input.itemId)
		return rejected(workspaceRoot, before, "ITEM_NOT_CURRENT", "O claim exige o item vigente.", input, subject);

	// Resolve MCP actor to role ID using runtimeBindings
	const resolvedActor = resolveMcpActor(workspaceRoot, input.actor.trim(), item.stage);
	const actorForClaim = resolvedActor;
	const handoffExpiresAt = item.handoff?.expiresAt
		? Date.parse(item.handoff.expiresAt)
		: Number.NaN;
	const isCurrentHandoffRecipient =
		item.handoff?.to === actorForClaim &&
		Number.isFinite(handoffExpiresAt) &&
		handoffExpiresAt > Date.now() &&
		(!item.handoff.executorId || item.handoff.executorId === input.executorId);

	if (stage?.agents.length && !stage.agents.includes(actorForClaim) && !isCurrentHandoffRecipient)
		return rejected(workspaceRoot, before, "ACTOR_NOT_ALLOWED", `Actor não autorizado no estágio ${stage.id}: ${input.actor}.`, input, subject);
	const capabilities = isCurrentHandoffRecipient
		? flow?.roles.find((role) => role.id === actorForClaim)?.capabilities ?? []
		: stage?.roles.flatMap((role) => role.capabilities) ?? [];
	if (capabilities.length > 0 && !capabilities.includes(input.capability))
		return rejected(workspaceRoot, before, "CAPABILITY_INVALID", `Capability não permitida: ${input.capability}.`, input, subject);
	const claimHooks = (stage?.hooks?.on_enter ?? []).filter(
		(hook) => hook.auto && hook.requiresClaim,
	);
	for (const hook of claimHooks) {
		if (hook.action === "capture_baseline") continue;
		const operation = flow?.operations[hook.action];
		if (!operation) {
			return rejected(workspaceRoot, before, "HOOK_OPERATION_NOT_CONFIGURED", `O hook automático "${hook.action}" não possui operação declarada no flow.`, input, subject);
		}
		if (!operation.allowedInStages.includes("*") && !operation.allowedInStages.includes(item.stage)) {
			return rejected(workspaceRoot, before, "HOOK_STAGE_NOT_ALLOWED", `O hook automático "${hook.action}" não é permitido no estágio "${item.stage}".`, input, subject);
		}
		if (operation.requiredCapability && operation.requiredCapability !== input.capability) {
			return rejected(workspaceRoot, before, "CAPABILITY_INVALID", `O hook automático "${hook.action}" exige a capability "${operation.requiredCapability}".`, input, subject);
		}
	}
	const claimExpired = item.claimExpiresAt ? Date.now() >= Date.parse(item.claimExpiresAt) : false;
	if (item.claimedBy && !claimExpired && (item.claimedBy !== actorForClaim || item.claimExecutorId !== input.executorId))
		return rejected(workspaceRoot, before, "CLAIM_CONFLICT", `Item já está sob responsabilidade de ${item.claimedBy}.`, input, subject);
	const ttl = Math.max(1, Math.min(1440, input.ttlMinutes ?? 30));
	const now = new Date();
	item.claimedBy = actorForClaim;
	item.claimedAt = now.toISOString();
	item.claimExecutorId = input.executorId.trim();
	item.claimCapability = input.capability.trim();
	item.claimRevision = before.revision;
	item.claimTtlMinutes = ttl;
	item.claimExpiresAt = new Date(now.getTime() + ttl * 60_000).toISOString();
	if (!item.workflowVersionId && flow?.workflowVersionId) {
		item.workflowVersionId = flow.workflowVersionId;
		item.workflowVersionNumber = flow.workflowVersionNumber ?? undefined;
	}
	for (const hook of claimHooks) {
		if (hook.action === "capture_baseline" && !item.securityBaseline) {
			item.securityBaseline = captureSecurityBaseline(securityExecutionRoot(workspaceRoot, workflow));
		}
	}
	workflow.updatedAt = now.toISOString();
	const writeResult = await writeWorkflow(workspaceRoot, {
		workflow,
		source: "flow-claim",
		primaryItemId: item.id,
		skipSitrep: true,
		skipLog: true,
		skipAdapters: true,
		quiet: true,
		confineAdapterWrites: true,
		expectedRevision: before.revision,
	});
	if (!writeResult.ok)
		return rejected(workspaceRoot, before, "CLAIM_WRITE_FAILED", writeResult.error ?? "Falha ao persistir claim.", input, subject);
	let after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "agent_claim_requested", before, {
		outcome: "accepted",
		reasonCode: "CLAIM_ACCEPTED",
		reason: input.reason,
		actor: actorForClaim,
		itemId: item.id,
		details: { executorId: input.executorId, capability: input.capability, ttlMinutes: ttl, expiresAt: item.claimExpiresAt, originalActor: input.actor },
	});
	for (const hook of claimHooks) {
		if (hook.action === "capture_baseline") continue;
		if (hook.action === "security_review") {
			const hookResult = await runSecurityReviewOperation(workspaceRoot, {
				itemId: item.id,
				executorId: input.executorId,
				actor: actorForClaim,
				expectedRevision: after.revision,
				reason: `Hook automático on_enter: ${hook.action}`,
				idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:${hook.action}` : undefined,
			});
			after = hookResult.nextDirection;
			if (hookResult.outcome !== "accepted") {
				return rememberIdempotent(workspaceRoot, input, result(before, entry.id, hookResult.outcome, hookResult.reasonCode, hookResult.reason, after, { securityReview: hookResult.securityReview }));
			}
			continue;
		}
		return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "rejected", "HOOK_ACTION_UNSUPPORTED", `O hook automático "${hook.action}" não possui executor registrado.`, after));
	}
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "CLAIM_ACCEPTED", input.reason, after));
}

export async function recordExecutionEvent(
	root: string,
	input: ExecutionEventInput,
): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: input.status });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: input.status };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.trim()) return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Evento exige identidade do actor.", input, subject);
	if (!before.item || before.item.id !== input.itemId) return rejected(workspaceRoot, before, "ITEM_NOT_CURRENT", "Evento exige o item vigente.", input, subject);
	const workflow = loadWorkflow(workspaceRoot);
	const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	if (!workflow || !item) return rejected(workspaceRoot, before, "ITEM_NOT_FOUND", "Item não encontrado.", input, subject);
	const resolvedEventActor = resolveMcpActor(workspaceRoot, (input.actor ?? "").trim(), item.stage);
	const expired = !item.claimExpiresAt || Date.now() >= Date.parse(item.claimExpiresAt);
	if (item.claimedBy !== resolvedEventActor || item.claimExecutorId !== input.executorId) return rejected(workspaceRoot, before, "CLAIM_REQUIRED", "Actor e executor precisam possuir o claim vigente.", input, subject);
	if (expired) return rejected(workspaceRoot, before, "CLAIM_EXPIRED", "O lease do claim expirou; faça um novo claim.", input, subject);
	const nowDate = new Date();
	const now = nowDate.toISOString();
	item.activityStatus = input.status;
	if (input.status === "started") item.activityStartedAt = now;
	if (input.status === "heartbeat" || input.status === "started") item.lastHeartbeatAt = now;
	if (input.status === "heartbeat") item.claimExpiresAt = new Date(nowDate.getTime() + (item.claimTtlMinutes ?? 30) * 60_000).toISOString();
	if (input.status === "started" || input.status === "succeeded") item.lastFailure = undefined;
	if (input.status === "failed") item.lastFailure = { code: input.errorCode ?? "EXECUTION_FAILED", message: input.message ?? "Execução falhou.", recovery: input.recovery ?? "human", at: now };
	workflow.updatedAt = now;
	const writeResult = await writeWorkflow(workspaceRoot, { workflow, source: "flow-claim", primaryItemId: item.id, skipSitrep: true, skipLog: true, quiet: true, confineAdapterWrites: true, expectedRevision: before.revision });
	if (!writeResult.ok) return rejected(workspaceRoot, before, "EVENT_WRITE_FAILED", writeResult.error ?? "Falha ao persistir evento.", input, subject);
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "agent_execution_event", before, { outcome: "accepted", reasonCode: "EVENT_RECORDED", reason: input.reason, actor: input.actor, itemId: item.id, details: { status: input.status, executorId: input.executorId, message: input.message, recovery: input.recovery, errorCode: input.errorCode } });
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "EVENT_RECORDED", input.reason, after));
}

function markPendingAc(content: string, acId: string): string | null {
	const lines = content.split("\n");
	const expected = normalizeAcId(acId);
	const index = lines.findIndex((line) => {
		if (!/^\s*-\s*\[ \]\s*\*\*/.test(line)) return false;
		const label = line.match(/\*\*([^*]+)\*\*/)?.[1] ?? "";
		const id = label.match(/\bAC[\s-]?(\d+(?:\.\d+)*)\b/i);
		return id ? `AC${id[1]}` === expected : false;
	});
	if (index < 0) return null;
	lines[index] = lines[index].replace(/\[ \]/, "[x]");
	return lines.join("\n");
}

export async function runValidationOperation(
	root: string,
	context: OperationContext,
): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, context, { operation: "validate" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, context); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot);
	const stale = checkRevision(workspaceRoot, before, context, { operation: "validate" });
	if (stale) return stale;

	const validation = await validate(workspaceRoot, {
		format: "silent",
		exit: false,
		log: false,
	});
	const workflow = loadWorkflow(workspaceRoot);
	const item = before.item && workflow?.items.find((candidate) => candidate.id === before.item?.id);
	if (workflow && item) {
		const now = new Date();
		item.validation = {
			schemaVersion: "1",
			outcome: validation.failed === 0 ? "accepted" : "rejected",
			validatedAt: now.toISOString(),
			expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
			summary: {
				passed: validation.passed,
				failed: validation.failed,
				warnings: validation.warnings,
			},
		};
		workflow.updatedAt = now.toISOString();
		const write = await writeWorkflow(workspaceRoot, {
			workflow,
			source: "flow-validate",
			primaryItemId: item.id,
			skipAdapters: true,
			skipSitrep: true,
			skipLog: true,
			skipEngine: true,
		quiet: true,
		confineAdapterWrites: true,
		expectedRevision: before.revision,
		});
		if (!write.ok) {
			return rejected(
				workspaceRoot,
				before,
				"VALIDATION_EVIDENCE_WRITE_FAILED",
				write.error ?? "Falha ao persistir a evidência canônica de validação.",
				context,
				{ itemId: item.id, operation: "validate" },
			);
		}
	}
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "agent_validation_run", before, {
		outcome: validation.failed === 0 ? "accepted" : "rejected",
		reasonCode: validation.failed === 0 ? "VALIDATION_COMPLETED" : "VALIDATION_FAILED",
		reason: context.reason,
		actor: context.actor,
		itemId: before.item?.id,
		details: { validation, evidence: item?.validation },
	});
	return rememberIdempotent(workspaceRoot, context, result(
		before,
		entry.id,
		validation.failed === 0 ? "accepted" : "rejected",
		validation.failed === 0 ? "VALIDATION_COMPLETED" : "VALIDATION_FAILED",
		context.reason,
		after,
		{ validation },
	));
}

function securityPolicyFor(root: string): { blockOnCritical: boolean; blockOnHigh: boolean } {
	const harness = loadHarness(resolveHarnessRoot(root, DEFAULT_HARNESS_VERSION));
	const workflow = loadWorkflow(root);
	const policyId = workflow?.template
		? harness?.flows[workflow.template]?.defaultPolicy?.replace(/^.*[\\/]/, "").replace(/\.json$/, "")
		: "sdlc-default";
	const policy = policyId ? harness?.policies[policyId]?.security : undefined;
	return {
		blockOnCritical: policy?.blockOnCritical ?? true,
		blockOnHigh: policy?.blockOnHigh ?? true,
	};
}

function securityExecutionRoot(root: string, workflow: Workflow): string {
	const execution = resolveExecutionWorkspace({ workflow, workspaceRoot: root });
	return execution.ok ? execution.root : resolveSecurityExecutionRoot(root);
}

/** Execute and persist the one canonical item-scoped Security report. */
export async function runSecurityReviewOperation(
	root: string,
	input: SecurityReviewInput,
): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "security_review" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: "security_review" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.trim()) return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Revisão de Security exige identidade do actor.", input, subject);
	const workflow = loadWorkflow(workspaceRoot);
	const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	if (!workflow || !item) return rejected(workspaceRoot, before, "ITEM_NOT_FOUND", "Item não encontrado.", input, subject);
	const resolvedSecurityActor = resolveMcpActor(workspaceRoot, (input.actor ?? "").trim(), item.stage);
	const activeFlowForSecurity = resolveActiveFlow(workspaceRoot).flow;
	const securityOperation = activeFlowForSecurity?.operations.security_review;
	if (!activeFlowForSecurity || !securityOperation) {
		return rejected(workspaceRoot, before, "OPERATION_NOT_CONFIGURED", "O flow vigente não declara a operação security_review.", input, subject);
	}
	if (!securityOperation.allowedInStages.includes("*") && !securityOperation.allowedInStages.includes(item.stage)) {
		return rejected(workspaceRoot, before, "SECURITY_STAGE_REQUIRED", `A operação security_review não é permitida no estágio "${item.stage}".`, input, subject);
	}
	if (securityOperation.requiredCapability && item.claimCapability !== securityOperation.requiredCapability) {
		return rejected(workspaceRoot, before, "CAPABILITY_INVALID", `A operação security_review exige a capability "${securityOperation.requiredCapability}".`, input, subject);
	}
	if (securityOperation.requiresClaim !== false && (item.claimedBy !== resolvedSecurityActor || item.claimExecutorId !== input.executorId)) return rejected(workspaceRoot, before, "CLAIM_REQUIRED", "Actor e executor precisam possuir o claim vigente para executar security_review.", input, subject);
	const report = runScopedSecurityReview(securityExecutionRoot(workspaceRoot, workflow), item, securityPolicyFor(workspaceRoot));
	item.securityReview = report;
	workflow.updatedAt = new Date().toISOString();
	const reportPath = securityReportPath(workspaceRoot, item.id);
	mkdirSync(join(getLetraDir(workspaceRoot), "reports", "security"), { recursive: true });
	const reportTmp = `${reportPath}.tmp`;
	writeFileSync(reportTmp, JSON.stringify(report, null, 2), "utf8");
	const writeResult = await writeWorkflow(workspaceRoot, {
		workflow,
		source: "security-review",
		primaryItemId: item.id,
		skipAdapters: true,
		skipSitrep: true,
		skipLog: true,
		skipEngine: true,
		quiet: true,
		confineAdapterWrites: true,
		expectedRevision: before.revision,
	});
	if (!writeResult.ok) {
		try { unlinkSync(reportTmp); } catch { /* keep the canonical workspace usable after a failed CAS */ }
		return rejected(workspaceRoot, before, "SECURITY_REVIEW_WRITE_FAILED", writeResult.error ?? "Falha ao persistir a revisão de Security.", input, subject);
	}
	// Rename only after the workflow write succeeds, avoiding a report that
	// claims a review which was not recorded in the canonical item state.
	renameSync(reportTmp, reportPath);
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "agent_execution_event", before, {
		outcome: report.blockingFindings.length > 0 || report.decision === "needs-review" ? "rejected" : "accepted",
		reasonCode: report.reasonCode,
		reason: input.reason,
		actor: input.actor,
		itemId: item.id,
		details: { executorId: input.executorId, securityReview: report },
	});
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, report.blockingFindings.length > 0 || report.decision === "needs-review" ? "rejected" : "accepted", report.reasonCode, input.reason, after, { securityReview: report }));
}

export function completeAcOperation(root: string, input: CompleteAcInput): OperationResult {
	const invalid = guardInvalidWorkspace(root, input, { acId: input.acId, operation: "complete_ac" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const boundary = createWorkspaceBoundary(resolveWorkspaceRoot(root).workspaceDir);
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: before.item?.id, acId: input.acId, operation: "complete_ac" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.trim()) {
		return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Conclusão de AC exige identidade do actor.", input, subject);
	}

	const evidence = input.evidence.map((item) => item.trim()).filter(Boolean);
	if (evidence.length === 0) {
		return rejected(
			workspaceRoot,
			before,
			"REGRESSION_EVIDENCE_REQUIRED",
			"É obrigatória ao menos uma evidência verificável de regressão.",
			input,
			subject,
		);
	}
	const requestedAc = normalizeAcId(input.acId);
	const currentWorkflow = loadWorkflow(workspaceRoot);
	const currentItem = currentWorkflow?.items.find((candidate) => candidate.id === before.item?.id);
	const executorId = input.executorId?.trim() || currentItem?.claimExecutorId || "unknown";
	const claimExpiresAt = currentItem?.claimExpiresAt ? Date.parse(currentItem.claimExpiresAt) : Number.NaN;
	if (!currentItem || currentItem.claimedBy !== input.actor || currentItem.claimExecutorId !== executorId) {
		return rejected(workspaceRoot, before, "CLAIM_REQUIRED", "Conclusão de AC exige claim vigente do actor e executor.", input, subject);
	}
	if (!Number.isFinite(claimExpiresAt) || Date.now() >= claimExpiresAt) {
		return rejected(workspaceRoot, before, "CLAIM_EXPIRED", "O lease do claim expirou; faça heartbeat ou novo claim.", input, subject);
	}
	if (!before.pendingAC || normalizeAcId(before.pendingAC.id) !== requestedAc) {
		return rejected(
			workspaceRoot,
			before,
			"AC_NOT_CURRENT",
			`O AC solicitado não é o critério pendente vigente (${before.pendingAC?.id ?? "nenhum"}).`,
			input,
			subject,
		);
	}
	const spec = before.item?.spec;
	if (!spec || !/^[a-zA-Z0-9._-]+$/.test(spec)) {
		return rejected(
			workspaceRoot,
			before,
			"ACTIVE_SPEC_REQUIRED",
			"O item vigente não possui uma spec válida vinculada.",
			input,
			subject,
		);
	}

	const specDir = join(getLetraDir(workspaceRoot), "specs", spec);
	const specPath = boundary.assertPath(join(specDir, "spec.md"));
	if (!existsSync(specPath)) {
		return rejected(
			workspaceRoot,
			before,
			"ACTIVE_SPEC_REQUIRED",
			"A spec vigente não foi encontrada no workspace.",
			input,
			subject,
		);
	}
	const updatedSpec = markPendingAc(readFileSync(specPath, "utf-8"), requestedAc);
	if (!updatedSpec) {
		return rejected(
			workspaceRoot,
			before,
			"AC_NOT_PENDING",
			"O AC solicitado não está pendente na spec vigente.",
			input,
			subject,
		);
	}
	const acceptancePath = boundary.assertPath(join(specDir, "acceptance.md"));
	const updatedAcceptance = existsSync(acceptancePath)
		? markPendingAc(readFileSync(acceptancePath, "utf-8"), requestedAc)
		: null;

	const specTmp = `${specPath}.tmp`;
	writeFileSync(specTmp, updatedSpec, "utf-8");
	renameSync(specTmp, specPath);
	if (updatedAcceptance) {
		const acceptanceTmp = `${acceptancePath}.tmp`;
		writeFileSync(acceptanceTmp, updatedAcceptance, "utf-8");
		renameSync(acceptanceTmp, acceptancePath);
	}

	const workflow = loadWorkflow(workspaceRoot);
	if (workflow?.tools?.length) {
		generateAdapters(workspaceRoot, workflow.tools, {
			source: "flow-ac",
			quiet: true,
			confineWrites: true,
		});
	}
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "agent_ac_completion_requested", before, {
		outcome: "accepted",
		reasonCode: "AC_COMPLETED",
		reason: input.reason,
		actor: input.actor,
		itemId: before.item?.id,
		acId: requestedAc,
		details: { spec, evidence, executorId, afterRevision: after.revision },
	});
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "AC_COMPLETED", input.reason, after));
}

export async function requestTransitionOperation(
	root: string,
	input: RequestTransitionInput,
): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "request_transition" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: "request_transition" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.trim()) {
		return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Transição exige identidade do actor.", input, subject);
	}
	if (input.force && (!input.actor.trim().startsWith("human:") || !input.reason?.trim())) {
		return rejected(
			workspaceRoot,
			before,
			"ADMINISTRATIVE_OVERRIDE_REQUIRED",
			"Transição forçada exige actor humano verificável e motivo explícito.",
			input,
			subject,
		);
	}
	if (!before.item || before.item.id !== input.itemId) {
		return rejected(
			workspaceRoot,
			before,
			"ITEM_NOT_CURRENT",
			"A transição somente pode ser solicitada para o item vigente.",
			input,
			subject,
		);
	}
	// Review can deliberately create new acceptance criteria when it sends an
	// item back to Code. That is not a normal transition: it must carry the
	// reviewer identity, the corrections and the resulting implementer handoff.
	// Return this actionable code before inspecting pending ACs so every surface
	// directs callers to the one canonical rework operation.
	// YAML-driven: read rework config from flow definition instead of hardcoded stage/role names.
	const activeFlowForRework = resolveActiveFlow(workspaceRoot).flow;
	const sourceStageDefForRework = activeFlowForRework?.stages.find((s) => s.id === before.item?.stage);
	if (sourceStageDefForRework?.rework?.target === input.targetStageId) {
		const resolvedActorForRework = resolveMcpActor(workspaceRoot, input.actor.trim(), before.item?.stage ?? "");
		const isAllowedForRework = !sourceStageDefForRework.rework.allowed_actors?.length || sourceStageDefForRework.rework.allowed_actors.includes(resolvedActorForRework);
		if (isAllowedForRework) {
			return rejected(
				workspaceRoot,
				before,
				"REWORK_OPERATION_REQUIRED",
				`Retorno para "${sourceStageDefForRework.rework.target}" exige request_rework com critérios de aceitação explícitos.`,
				input,
				subject,
			);
		}
		return rejected(workspaceRoot, before, "ACTOR_NOT_ALLOWED", `O actor "${resolvedActorForRework}" não está autorizado para o retrabalho declarado no estágio "${sourceStageDefForRework.id}".`, input, subject);
	}
	if (before.pendingAC && !input.force) {
		return rejected(
			workspaceRoot,
			before,
			"PENDING_ACCEPTANCE_CRITERIA",
			`O item ainda possui o critério pendente ${before.pendingAC.id}.`,
			input,
			subject,
		);
	}

	const workflow = loadWorkflow(workspaceRoot);
	const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	const target = workflow?.stages.find((stage) => stage.id === input.targetStageId);
	if (!workflow || !item || !target) {
		return rejected(
			workspaceRoot,
			before,
			"INVALID_TRANSITION",
			"O item ou estágio de destino não existe no workflow vigente.",
			input,
			subject,
		);
	}
	if (item.stage === target.id) {
		return rejected(
			workspaceRoot,
			before,
			"INVALID_TRANSITION",
			"O item já está no estágio solicitado.",
			input,
			subject,
		);
	}
	const sourceStage = workflow?.stages.find((stage) => stage.id === item?.stage);
	const ownsClaim = item?.claimedBy === input.actor;
	const adjacentTransition = sourceStage
		? Math.abs(target.order - sourceStage.order) === 1
		: false;

	const activeFlow = resolveActiveFlow(workspaceRoot, {
		itemId: item.id,
		workflowVersionId: item.workflowVersionId,
	}).flow;
	const sourceDefinition = activeFlow?.stages.find((stage) => stage.id === item.stage);
	const targetDefinition = activeFlow?.stages.find((stage) => stage.id === target.id);

	// Check for valid handoff to target stage
	const hasValidHandoff = item?.handoff &&
		item.handoff.expiresAt &&
		Date.now() < Date.parse(item.handoff.expiresAt) &&
		(targetDefinition?.agents ?? []).includes(item.handoff.to);

	if (
		!input.actor.startsWith("human:") &&
		before.allowedStageIds.length > 0 &&
		!before.allowedStageIds.includes(target.id) &&
		!(ownsClaim && adjacentTransition) &&
		!hasValidHandoff
	) {
		return rejected(
			workspaceRoot,
			before,
			"STAGE_NOT_ALLOWED",
			"O papel vigente não permite transição para o estágio solicitado.",
			input,
			subject,
		);
	}
	// Gates protect exit from the current stage. The target stage's gate is
	// evaluated when that stage later hands off, so entering it remains valid.
	const blockingGate = sourceDefinition?.gate?.blocking ? sourceDefinition.gate : null;
	if (blockingGate) {
		const checker = new GateChecker(workspaceRoot);
		const gateResult = checker.check(blockingGate.id, item);
		if (blockingGate.type === "human") {
			const gateHint = targetDefinition?.activity?.gate;
			const reviewHint = targetDefinition?.activity?.review;
			const enriched: AgentDirectionSnapshot = {
				...before,
				allowedStageIds: targetDefinition
					? [...new Set(targetDefinition.roles.flatMap((role) => role.allowedStages))]
					: before.allowedStageIds,
				prohibitions: [...(gateHint?.mustNotDo ?? reviewHint?.mustNotDo ?? [])],
				requiredEvidence: gateHint?.evidence ? [gateHint.evidence] : [],
			};
			(enriched as unknown as Record<string, unknown>).pendingAC = undefined;
			const entry = audit(workspaceRoot, "agent_transition_requested", before, {
				outcome: "approval-required",
				reasonCode: "HUMAN_APPROVAL_REQUIRED",
				reason: `O gate "${blockingGate.name}" exige decisão humana explícita.`,
				actor: input.actor,
				itemId: item.id,
				details: { from: item.stage, to: target.id, gateId: blockingGate.id },
			});
			return result(
				before,
				entry.id,
				"approval-required",
				"HUMAN_APPROVAL_REQUIRED",
				`O gate "${blockingGate.name}" exige decisão humana explícita.`,
				enriched,
			);
		}
		if (!gateResult.allowed) {
			return rejected(
				workspaceRoot,
				before,
			gateResult.reasonCode ?? "BLOCKING_GATE",
				gateResult.reason ??
					`O gate "${blockingGate.name}" deve ser satisfeito antes da transição.`,
				input,
				subject,
			);
		}
	}

	const from = item.stage;
	// YAML-driven hooks: read on_enter hooks from flow definition instead of hardcoded stage names.
	const activeFlowForHooks = resolveActiveFlow(workspaceRoot).flow;
	const targetStageDefForHooks = activeFlowForHooks?.stages.find((s) => s.id === target.id);
	const onEnterHooks = targetStageDefForHooks?.hooks?.on_enter ?? [];
	for (const hook of onEnterHooks) {
		if (!hook.auto) continue;
		if (hook.requiresClaim && !ownsClaim) continue;
		if (hook.action === "capture_baseline" && !item.securityBaseline) {
			const executionRoot = securityExecutionRoot(workspaceRoot, workflow);
			item.securityBaseline = captureSecurityBaseline(executionRoot);
		}
	}
	item.stage = target.id;
	if (!item.workflowVersionId && activeFlow?.workflowVersionId) {
		item.workflowVersionId = activeFlow.workflowVersionId;
		item.workflowVersionNumber = activeFlow.workflowVersionNumber ?? undefined;
	}
	workflow.updatedAt = new Date().toISOString();
	const writeResult = await writeWorkflow(workspaceRoot, {
		workflow,
		source: "flow-move",
		primaryItemId: item.id,
		skipSitrep: true,
		skipLog: true,
		quiet: true,
		confineAdapterWrites: true,
		expectedRevision: before.revision,
	});
	if (!writeResult.ok) {
		return rejected(
			workspaceRoot,
			before,
			"TRANSITION_WRITE_FAILED",
			writeResult.error ?? "A persistência da transição falhou.",
			input,
			subject,
		);
	}
	if (item.spec) writeFocusWithRecommendations(workspaceRoot, item.spec, item.id);

	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "agent_transition_requested", before, {
		outcome: "accepted",
		reasonCode: "TRANSITION_COMPLETED",
		reason: input.reason,
		actor: input.actor,
		itemId: item.id,
		details: {
			from,
			to: target.id,
			afterRevision: after.revision,
			administrativeOverride: input.force === true,
			pendingAcBypassed: input.force ? before.pendingAC?.id ?? null : null,
		},
	});
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "TRANSITION_COMPLETED", input.reason, after));
}

export async function activateWorkOperation(root: string, input: ActivateWorkInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "activate_work" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: "activate_work" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.startsWith("human:")) return rejected(workspaceRoot, before, "HUMAN_ACTOR_REQUIRED", "A ativação inicial exige uma decisão humana identificada.", input, subject);
	const workflow = loadWorkflow(workspaceRoot);
	const flow = resolveActiveFlow(workspaceRoot).flow;
	const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	if (!workflow || !flow || !item) return rejected(workspaceRoot, before, "ITEM_NOT_FOUND", "Item ou fluxo não encontrado.", input, subject);
	const current = flow.stages.find((stage) => stage.id === item.stage);
	const initial = flow.stages.filter((stage) => stage.roleIds.length > 0 && stage.id !== item.stage).sort((left, right) => left.order - right.order)[0];
	if (!current || current.roleIds.length > 0 || !initial) return rejected(workspaceRoot, before, "ACTIVATION_NOT_ALLOWED", "Somente um item no Backlog sem responsável pode ser ativado.", input, subject);
	const actor = initial.roleIds[0];
	if (!actor) return rejected(workspaceRoot, before, "NO_COMPATIBLE_BINDING", "O estágio inicial não possui uma persona permitida.", input, subject);
	const now = new Date();
	item.stage = initial.id;
	item.handoff = {
		from: input.actor,
		to: actor,
		summary: `Ativação humana: ${input.reason}`,
		evidence: ["activation:human-approved"],
		timestamp: now.toISOString(),
		expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
	};
	item.claimedBy = undefined; item.claimedAt = undefined; item.claimExpiresAt = undefined; item.claimExecutorId = undefined; item.claimCapability = undefined; item.claimRevision = undefined; item.claimTtlMinutes = undefined;
	workflow.primaryItemId = item.id;
	workflow.updatedAt = now.toISOString();
	const writeResult = await writeWorkflow(workspaceRoot, { workflow, source: "flow-handoff", primaryItemId: item.id, skipSitrep: true, skipLog: true, quiet: true, confineAdapterWrites: true, expectedRevision: resolveAgentDirection(workspaceRoot).revision });
	if (!writeResult.ok) return rejected(workspaceRoot, before, "ACTIVATION_WRITE_FAILED", writeResult.error ?? "Falha ao persistir a ativação.", input, subject);
	if (item.spec) writeFocusWithRecommendations(workspaceRoot, item.spec, item.id);
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "handoff", before, {
		outcome: "accepted", reasonCode: "WORK_ACTIVATED", reason: input.reason, actor: input.actor, itemId: item.id,
		details: { from: current.id, to: initial.id, handoffTo: actor, afterRevision: after.revision },
	});
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "WORK_ACTIVATED", input.reason, after));
}

export async function releaseClaimOperation(root: string, input: ReleaseClaimInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "release_claim" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: "release_claim" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.trim()) return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Release exige identidade do actor.", input, subject);
	const workflow = loadWorkflow(workspaceRoot);
	const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	if (!workflow || !item) return rejected(workspaceRoot, before, "ITEM_NOT_FOUND", "Item não encontrado.", input, subject);
	const resolvedReleaseActor = resolveMcpActor(workspaceRoot, (input.actor ?? "").trim(), item.stage);
	if (item.claimedBy && item.claimedBy !== resolvedReleaseActor) return rejected(workspaceRoot, before, "CLAIM_CONFLICT", "Somente o actor do claim pode liberá-lo.", input, subject);
	item.claimedBy = undefined; item.claimedAt = undefined; item.claimExpiresAt = undefined; item.claimExecutorId = undefined; item.claimCapability = undefined; item.claimRevision = undefined; item.claimTtlMinutes = undefined;
	workflow.updatedAt = new Date().toISOString();
	const writeResult = await writeWorkflow(workspaceRoot, { workflow, source: "flow-release", primaryItemId: item.id, skipSitrep: true, skipLog: true, quiet: true, confineAdapterWrites: true, expectedRevision: before.revision });
	if (!writeResult.ok) return rejected(workspaceRoot, before, "RELEASE_WRITE_FAILED", writeResult.error ?? "Falha ao liberar claim.", input, subject);
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "agent_claim_requested", before, { outcome: "accepted", reasonCode: "CLAIM_RELEASED", reason: input.reason, actor: input.actor, itemId: item.id });
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "CLAIM_RELEASED", input.reason, after));
}

/** Recover every expired persisted lease after a dispatcher restart. */
export async function reclaimExpiredClaimsOperation(root: string, input: ReclaimExpiredClaimsInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { operation: "reclaim_expired_claims" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot); const subject = { operation: "reclaim_expired_claims" };
	const stale = checkRevision(workspaceRoot, before, input, subject); if (stale) return stale;
	if (!input.actor?.startsWith("system:")) return rejected(workspaceRoot, before, "SYSTEM_ACTOR_REQUIRED", "Recovery automática exige identidade system verificável.", input, subject);
	const workflow = loadWorkflow(workspaceRoot); if (!workflow) return rejected(workspaceRoot, before, "WORKFLOW_NOT_FOUND", "Workflow não encontrado.", input, subject);
	const now = Date.now(); const reclaimed: string[] = [];
	for (const item of workflow.items) {
		const expiry = item.claimExpiresAt ? Date.parse(item.claimExpiresAt) : Number.NaN;
		if (!item.claimedBy || !Number.isFinite(expiry) || now < expiry) continue;
		for (const key of ["claimedBy", "claimedAt", "claimExpiresAt", "claimExecutorId", "claimCapability", "claimRevision", "claimTtlMinutes", "activityStatus", "activityStartedAt", "lastHeartbeatAt"] as const) item[key] = undefined;
		reclaimed.push(item.id);
	}
	if (reclaimed.length === 0) return result(before, "reclaim-none", "accepted", "NO_EXPIRED_CLAIMS", "Nenhum claim expirado para recuperar.", before);
	workflow.updatedAt = new Date().toISOString();
	const write = await writeWorkflow(workspaceRoot, { workflow, source: "orchestrator-reclaim", skipSitrep: true, skipLog: true, quiet: true, expectedRevision: before.revision });
	if (!write.ok) return rejected(workspaceRoot, before, write.error?.startsWith("DIRECTION_STALE") ? "DIRECTION_STALE" : "RECLAIM_WRITE_FAILED", write.error ?? "Falha ao recuperar claims expirados.", input, subject);
	const after = resolveAgentDirection(workspaceRoot); const entry = audit(workspaceRoot, "item_reclaim", before, { outcome: "accepted", reasonCode: "CLAIMS_RECLAIMED", reason: input.reason, actor: input.actor, details: { itemIds: reclaimed } });
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "CLAIMS_RECLAIMED", input.reason, after));
}

/** Roll back a pending handoff without recreating a second claim state. */
export async function rollbackHandoffOperation(root: string, input: RollbackHandoffInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "rollback_handoff" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: "rollback_handoff" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.trim()) return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Rollback exige identidade do actor.", input, subject);
	const workflow = loadWorkflow(workspaceRoot);
	const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	if (!workflow || !item) return rejected(workspaceRoot, before, "ITEM_NOT_FOUND", "Item não encontrado.", input, subject);
	if (!item.handoff) return rejected(workspaceRoot, before, "HANDOFF_NOT_FOUND", "O item não possui handoff pendente.", input, subject);
	const previousTo = item.handoff.to;
	const previousFrom = item.handoff.from;
	const previousExecutor = item.handoff.executorId;
	item.handoff = undefined;
	item.claimedBy = previousFrom;
	item.claimedAt = new Date().toISOString();
	item.claimExecutorId = previousExecutor;
	workflow.updatedAt = new Date().toISOString();
	const writeResult = await writeWorkflow(workspaceRoot, { workflow, source: "flow-handoff-rollback", primaryItemId: item.id, skipSitrep: true, skipLog: true, quiet: true, confineAdapterWrites: true, expectedRevision: before.revision });
	if (!writeResult.ok) return rejected(workspaceRoot, before, "ROLLBACK_WRITE_FAILED", writeResult.error ?? "Falha ao desfazer handoff.", input, subject);
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "handoff_rollback", before, { outcome: "accepted", reasonCode: "HANDOFF_ROLLED_BACK", reason: input.reason, actor: input.actor, itemId: item.id, details: { previousTo, afterRevision: after.revision } });
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "HANDOFF_ROLLED_BACK", input.reason, after));
}

function appendReviewAcceptanceCriteria(
	specPath: string,
	acceptancePath: string | null,
	criteria: RequestReworkInput["acceptanceCriteria"],
): string[] {
	const current = readFileSync(specPath, "utf8");
	const used = new Set([...current.matchAll(/\bAC(\d+)\b/gi)].map((match) => `AC${match[1]}`));
	let next = Math.max(0, ...[...used].map((id) => Number(id.slice(2)))) + 1;
	const normalized = criteria.map((criterion) => {
		const description = criterion.description.trim();
		if (!description) throw new Error("Todo apontamento de retrabalho precisa de descrição.");
		let id = criterion.id?.trim().toUpperCase();
		if (id && !/^AC\d+$/.test(id)) throw new Error(`Identificador de AC inválido: ${id}.`);
		if (!id) {
			while (used.has(`AC${next}`)) next += 1;
			id = `AC${next++}`;
		}
		if (used.has(id)) throw new Error(`O critério ${id} já existe na spec.`);
		used.add(id);
		return { id, description };
	});
	const block = ["", "## Retorno de revisão", "", ...normalized.map(({ id, description }) => `- [ ] **${id} — Correção de revisão**: ${description}`), ""].join("\n");
	const nextSpec = `${current.trimEnd()}\n${block}`;
	const acceptance = acceptancePath && existsSync(acceptancePath)
		? readFileSync(acceptancePath, "utf8")
		: null;
	const nextAcceptance = acceptance === null ? null : `${acceptance.trimEnd()}\n${block}`;

	// Keep the compact acceptance projection in lockstep with the canonical
	// spec.  This prevents CLI, web and MCP readers from observing a different
	// pending-AC set immediately after a reviewer requests rework.
	const specTmp = `${specPath}.tmp`;
	writeFileSync(specTmp, nextSpec, "utf8");
	if (acceptancePath && nextAcceptance !== null) {
		const acceptanceTmp = `${acceptancePath}.tmp`;
		writeFileSync(acceptanceTmp, nextAcceptance, "utf8");
		renameSync(acceptanceTmp, acceptancePath);
	}
	renameSync(specTmp, specPath);
	return normalized.map(({ id }) => id);
}

/**
 * The only supported rework route. It creates the work to be redone,
 * transfers ownership to the target agent and preserves the audit trail.
 * YAML-driven: reads rework config from flow definition.
 */
export async function requestReworkOperation(root: string, input: RequestReworkInput): Promise<OperationResult> {
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "request_rework" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: "request_rework" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.trim()) {
		return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Retrabalho exige identidade do actor.", input, subject);
	}
	const workflow = loadWorkflow(workspaceRoot);
	const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	if (!workflow || !item) {
		return rejected(workspaceRoot, before, "ITEM_NOT_FOUND", "Item não encontrado.", input, subject);
	}
	// YAML-driven: read rework config from flow definition
	const activeFlowForRework = resolveActiveFlow(workspaceRoot).flow;
	const sourceStageDef = activeFlowForRework?.stages.find((s) => s.id === item.stage);
	if (!sourceStageDef?.rework) {
		return rejected(workspaceRoot, before, "REWORK_NOT_ALLOWED", `O estágio "${item.stage}" não possui configuração de retrabalho.`, input, subject);
	}
	const resolvedReworkActor = resolveMcpActor(workspaceRoot, (input.actor ?? "").trim(), item.stage);
	const isAllowedActor = !sourceStageDef.rework.allowed_actors?.length || sourceStageDef.rework.allowed_actors.includes(resolvedReworkActor);
	if (!isAllowedActor) {
		return rejected(workspaceRoot, before, "REWORK_ACTOR_REQUIRED", `O actor "${resolvedReworkActor}" não está autorizado a solicitar retrabalho neste estágio.`, input, subject);
	}
	const reworkOperation = activeFlowForRework?.operations.rework;
	if (reworkOperation?.requiresClaim === true && item.claimedBy !== resolvedReworkActor) {
		return rejected(workspaceRoot, before, "CLAIM_REQUIRED", "O actor precisa possuir o claim vigente antes de solicitar retrabalho.", input, subject);
	}
	const mustCreateAcceptanceCriteria = sourceStageDef.rework.create_ac === true;
	if (mustCreateAcceptanceCriteria && input.acceptanceCriteria.length === 0) return rejected(workspaceRoot, before, "REWORK_ACCEPTANCE_REQUIRED", "A configuração de retrabalho exige ao menos um critério de aceitação.", input, subject);
	// YAML-driven: read rework target from flow definition
	const reworkTargetStage = activeFlowForRework?.stages.find((s) => s.id === sourceStageDef.rework!.target);
	if (!reworkTargetStage || !item.spec) {
		return rejected(workspaceRoot, before, "REWORK_TARGET_UNAVAILABLE", "O fluxo não possui estágio de destino ou spec vinculada para registrar o retrabalho.", input, subject);
	}
	const specPath = join(getLetraDir(workspaceRoot), "specs", item.spec, "spec.md");
	if (!existsSync(specPath)) return rejected(workspaceRoot, before, "ACTIVE_SPEC_REQUIRED", "A spec vinculada ao item não existe.", input, subject);
	const acceptancePath = join(getLetraDir(workspaceRoot), "specs", item.spec, "acceptance.md");
	let created: string[] = [];
	if (mustCreateAcceptanceCriteria) {
		try {
			created = appendReviewAcceptanceCriteria(specPath, acceptancePath, input.acceptanceCriteria);
		} catch (error) {
			return rejected(workspaceRoot, before, "REWORK_AC_INVALID", error instanceof Error ? error.message : String(error), input, subject);
		}
	}
	const now = new Date();
	const from = item.stage;
	// YAML-driven: use rework target stage and its first agent
	item.stage = reworkTargetStage.id;
	const handoffTarget = reworkTargetStage.agents?.[0] ?? reworkTargetStage.id;
	item.handoff = {
		from: input.actor,
		to: handoffTarget,
		summary: `Retrabalho solicitado em ${sourceStageDef.name}: ${input.reason}`,
		evidence: created.map((id) => `spec:${item.spec}:${id}`),
		timestamp: now.toISOString(),
		expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
	};
	item.claimedBy = undefined; item.claimedAt = undefined; item.claimExpiresAt = undefined; item.claimExecutorId = undefined; item.claimCapability = undefined; item.claimRevision = undefined; item.claimTtlMinutes = undefined;
	// A rework has a new owner and a new execution attempt. No runtime detail
	// from the reviewer may make the target agent look busy, stale or failed.
	item.activityStatus = undefined;
	item.activityStartedAt = undefined;
	item.lastHeartbeatAt = undefined;
	item.lastFailure = undefined;
	item.retryCount = undefined;
	workflow.updatedAt = now.toISOString();
	// appendReviewAcceptanceCriteria changes the spec projection before the
	// workflow write, so refresh the CAS token after that canonical spec edit.
	const writeResult = await writeWorkflow(workspaceRoot, { workflow, source: "flow-handoff", primaryItemId: item.id, skipSitrep: true, skipLog: true, quiet: true, confineAdapterWrites: true, expectedRevision: resolveAgentDirection(workspaceRoot).revision });
	if (!writeResult.ok) return rejected(workspaceRoot, before, "REWORK_WRITE_FAILED", writeResult.error ?? "Falha ao persistir o retorno para retrabalho.", input, subject);
	if (item.spec) writeFocusWithRecommendations(workspaceRoot, item.spec, item.id);
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "agent_transition_requested", before, {
		outcome: "accepted", reasonCode: "REWORK_REQUESTED", reason: input.reason, actor: input.actor, itemId: item.id,
		details: { from, to: reworkTargetStage.id, handoffTo: handoffTarget, createdAcceptanceCriteria: created, afterRevision: after.revision },
	});
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "REWORK_REQUESTED", input.reason, after));
}

export async function decideGateOperation(root: string, input: GateDecisionInput): Promise<OperationResult> {
	assertOperationLevel(root, input.actor ?? "", "local");
	const invalid = guardInvalidWorkspace(root, input, { itemId: input.itemId, operation: "gate_decision" });
	if (invalid) return invalid;
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const replay = replayIdempotent(workspaceRoot, input); if (replay) return replay;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: "gate_decision" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
	if (!input.actor?.trim()) return rejected(workspaceRoot, before, "ACTOR_REQUIRED", "Decisão de gate exige identidade humana.", input, subject);
	if (!input.actor.trim().startsWith("human:")) return rejected(workspaceRoot, before, "HUMAN_ACTOR_REQUIRED", "Somente uma identidade humana verificável pode decidir este gate.", input, subject);
	const workflow = loadWorkflow(workspaceRoot);
	const item = workflow?.items.find((candidate) => candidate.id === input.itemId);
	const flow = resolveActiveFlow(workspaceRoot).flow;
	const gate = flow?.stages.find((stage) => stage.id === item?.stage)?.gate;
	if (!workflow || !item || !flow || !gate || gate.type !== "human" || !gate.blocking) return rejected(workspaceRoot, before, "GATE_NOT_WAITING", "Item não está aguardando gate humano bloqueante.", input, subject);
	const targetRule = gate.decisions?.[input.decision];
	const targetStageId = targetRule ? resolveDecisionTargetStage(flow.stages, item.stage, targetRule) : null;
	if (!targetStageId) return rejected(workspaceRoot, before, "INVALID_GATE_DECISION", "Decisão não possui destino válido no harness.", input, subject);
	const targetStage = flow.stages.find((stage) => stage.id === targetStageId);
	const targetActor = targetStage?.roles[0]?.id;
	const sourceStage = item.stage;
	item.stage = targetStageId;
	item.handoff = targetActor ? { from: input.actor, to: targetActor, summary: `Gate ${gate.name}: ${input.decision}`, evidence: [`gate:${gate.id}:${input.decision}`], timestamp: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } : undefined;
	item.claimedBy = undefined; item.claimedAt = undefined; item.claimExpiresAt = undefined; item.claimExecutorId = undefined; item.claimCapability = undefined; item.claimRevision = undefined; item.claimTtlMinutes = undefined;
	workflow.updatedAt = new Date().toISOString();
	const writeResult = await writeWorkflow(workspaceRoot, { workflow, source: "web-ui-gate-decision", primaryItemId: item.id, skipSitrep: true, skipLog: true, quiet: true, confineAdapterWrites: true, expectedRevision: before.revision });
	if (!writeResult.ok) return rejected(workspaceRoot, before, "GATE_DECISION_WRITE_FAILED", writeResult.error ?? "Falha ao persistir decisão.", input, subject);
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "decision", before, { outcome: "accepted", reasonCode: "GATE_DECISION_RECORDED", reason: input.reason, actor: input.actor, itemId: item.id, details: { gateId: gate.id, decision: input.decision, from: sourceStage, to: targetStageId } });
	return rememberIdempotent(workspaceRoot, input, result(before, entry.id, "accepted", "GATE_DECISION_RECORDED", input.reason, after));
}
