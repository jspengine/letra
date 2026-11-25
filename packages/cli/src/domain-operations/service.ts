import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
  realpathSync,
  statSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type {
  AgentDirectionSnapshot,
  AgentRegistry,
  AgentRuntimeBinding,
  RunEntity,
} from "@letra/types";
import type { Item, Workflow } from "../commands/flow-init.js";
import {
  createAgentDirectionSnapshot,
  resolveAgentDirection,
  resolveDirection,
  resolveOperationDirection,
  withRunAssignment,
} from "../agent-direction/service.js";
import {
  createExecutionRun,
  isRunActiveForDirection,
  readExecutionRuns,
  updateExecutionRun,
} from "../execution-runs/store.js";
import {
  listWorkflowDefinitions,
  listWorkflowVersions,
  validateWorkflowContent,
} from "../workflow-versions/service.js";
import { evaluateTransitionRepetition } from "../workflow-versions/repetition-policy.js";
import { generateAdapters } from "../adapters/generate.js";
import { writeFocusWithRecommendations } from "../adapters/focus-recommendations.js";
import { loadWorkflow, writeWorkflow } from "../commands/flow-init.js";
import { validate, type ValidationSummary } from "../commands/validate.js";
import { resolveActiveFlow } from "../flow-definition/resolve.js";
import {
  loadHarness,
  resolveHarnessRoot,
  DEFAULT_HARNESS_VERSION,
} from "../harness/loader.js";
import { createWorkspaceBoundary } from "../security/workspace-boundary.js";
import { resolveExecutionWorkspace } from "../orchestrator/execution-workspace.js";
import {
  createLogEntry,
  jsonlPathForDate,
  logEntry,
  type LogAction,
} from "../session-log.js";
import {
  commitWorkspaceTransaction,
  isWorkspaceTransactionCommitted,
  recoverWorkspaceTransaction,
  withWorkspaceTransactionLock,
  withWorkspaceTransactionLockSync,
} from "./workspace-transaction.js";
import { GateChecker } from "../harness/gate-checker.js";
import {
  getLetraDir,
  resolveDataDir,
  resolveWorkspaceRoot,
} from "../workspace/resolver.js";
import {
  assertOperationLevel,
  OPERATION_REQUIRED_LEVELS,
  requireLocalHumanStrict,
} from "../identity/guard.js";
import type { SignedOperationProof } from "../identity/signing.js";
import {
  invalidWorkspaceDiagnostic,
  type WorkspaceIntegrityDiagnostic,
} from "../workspace/integrity.js";
import {
  captureSecurityBaseline,
  runScopedSecurityReview,
  resolveSecurityExecutionRoot,
  securityReportPath,
  type SecurityReviewReport,
} from "../security/scoped-review.js";
import { loadAgents } from "../agents/service.js";
import { executorSupports } from "../agents/runtime-binding.js";

/**
 * Transport that carried the operation, for audit entries. The concrete client
 * (e.g. "mcp:Visual Studio Code") stays in `details.by`.
 */
function auditAdapter(actor: string | undefined): "mcp" | "cli" {
  return actor?.startsWith("mcp:") ? "mcp" : "cli";
}

/**
 * Resolves actor from MCP format (e.g., "mcp:opencode") to role ID (e.g., "implementer")
 * using the runtimeBindings from agents.json.
 */
function resolveMcpActor(
  workspaceRoot: string,
  actor: string,
  stageId: string,
  executorId?: string,
): string {
  // Only resolve MCP actors
  if (!actor.startsWith("mcp:")) return actor;

  // Extract executor name from "mcp:opencode" -> "opencode"
  const executorName = actor.slice(4);
  if (!executorName) return actor;

  try {
    const registry = loadAgents(workspaceRoot);
    const runtimeBindings = registry.runtimeBindings ?? [];

    // Find binding that matches executorId and stageId
    const executorCandidates = [
      ...new Set(
        [executorName, executorId].filter((value): value is string =>
          Boolean(value),
        ),
      ),
    ];
    for (const candidate of executorCandidates) {
      const bindings = runtimeBindings.filter(
        (binding) =>
          binding.executorId === candidate &&
          binding.stageIds.includes(stageId),
      );
      const roles = [...new Set(bindings.map((binding) => binding.roleId))];
      if (roles.length === 1) return roles[0]!;
    }
  } catch {
    // If we can't load the registry, return the original actor
  }

  return actor;
}

function resolveDestinationRuntimeBinding(
  workspaceRoot: string,
  roleId: string,
  target: NonNullable<
    ReturnType<typeof resolveActiveFlow>["flow"]
  >["stages"][number],
  manifest: ReturnType<typeof loadHarness>,
): AgentRuntimeBinding | null {
  const executorRegistry = manifest?.executors;
  if (!executorRegistry?.executors.length) return null;
  const agents = loadAgents(workspaceRoot);
  const identities = new Map(
    agents.agents.map((identity) => [identity.id, identity]),
  );
  const executors = new Map(
    executorRegistry.executors.map((executor) => [executor.id, executor]),
  );
  const role = target.roles.find((candidate) => candidate.id === roleId);
  const preferences = [
    ...(target.preferredExecutor ? [target.preferredExecutor] : []),
    ...(executorRegistry.stageExecutorPreferences[target.id] ?? []),
    ...(executorRegistry.stageExecutorPreferences[roleId] ?? []),
  ];
  const preferenceIndex = new Map(
    [...new Set(preferences)].map((executorId, index) => [executorId, index]),
  );
  const roleCapabilities = role?.capabilities ?? [];
  const candidates = (agents.runtimeBindings ?? []).filter((binding) => {
    if (binding.roleId !== roleId || !binding.stageIds.includes(target.id))
      return false;
    const identity = identities.get(binding.identityId);
    if (!identity || !identity.stageBindings.includes(target.id)) return false;
    const roles = identity.roleIds?.length ? identity.roleIds : [identity.role];
    if (!roles.includes(roleId)) return false;
    const executor = executors.get(binding.executorId);
    if (
      !executor ||
      !roleCapabilities.every(
        (capability) =>
          binding.capabilities.includes(capability) &&
          executorSupports(executor, capability),
      )
    )
      return false;
    return true;
  });
  candidates.sort((left, right) => {
    const leftPreference =
      preferenceIndex.get(left.executorId) ?? Number.MAX_SAFE_INTEGER;
    const rightPreference =
      preferenceIndex.get(right.executorId) ?? Number.MAX_SAFE_INTEGER;
    const leftPriority =
      executors.get(left.executorId)?.priority ?? Number.MAX_SAFE_INTEGER;
    const rightPriority =
      executors.get(right.executorId)?.priority ?? Number.MAX_SAFE_INTEGER;
    return (
      leftPreference - rightPreference ||
      leftPriority - rightPriority ||
      left.id.localeCompare(right.id)
    );
  });
  return candidates[0] ?? null;
}

function resolveClaimRuntimeBinding(
  workspaceRoot: string,
  roleId: string,
  executorId: string,
  stageId: string,
  identityId?: string,
): AgentRuntimeBinding | null {
  const registry = loadAgents(workspaceRoot);
  return (
    (registry.runtimeBindings ?? []).find(
      (binding) =>
        binding.roleId === roleId &&
        binding.executorId === executorId &&
        binding.stageIds.includes(stageId) &&
        (!identityId || binding.identityId === identityId),
    ) ?? null
  );
}

export type OperationOutcome = "accepted" | "rejected" | "approval-required";

export interface OperationResult {
  outcome: OperationOutcome;
  auditId: string;
  beforeRevision: string;
  afterRevision: string;
  reasonCode: string;
  reason: string;
  recoveryActions?: string[];
  /** Refusals only: the exact command to run next (AC4). */
  nextCommand?: string;
  /** Refusals only: the next step belongs to a human, not to the agent. */
  humanRequired?: boolean;
  nextDirection: AgentDirectionSnapshot;
  validation?: ValidationSummary;
  workspace?: WorkspaceIntegrityDiagnostic;
  securityReview?: SecurityReviewReport;
  createdItem?: Pick<Item, "id" | "description" | "stage" | "spec">;
  linkedSpec?: string;
}

interface OperationContext {
  expectedRevision: string;
  reason: string;
  actor?: string;
  idempotencyKey?: string;
}

export interface CompleteAcInput extends OperationContext {
  itemId: string;
  acId: string;
  evidence: string[];
  executorId?: string;
  runId?: string;
}

export interface MigrateRunWorkflowInput extends OperationContext {
  runId: string;
  toWorkflowVersionId: string;
  toStageId: string;
  expectedRunRevision: number;
  proof?: SignedOperationProof;
}

export interface RunValidationInput extends OperationContext {
  itemId?: string;
  runId?: string;
  executorId?: string;
}

export interface RequestTransitionInput extends OperationContext {
  itemId: string;
  targetStageId: string;
  /** Explicit human override for administrative transitions with pending ACs. */
  force?: boolean;
}

export interface RequestPassageInput extends HandoffInput {
  /** Omit to resolve the destination from the item's active workflow version. */
  targetStageId?: string;
  runId?: string;
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
  evidence: Array<{
    kind: "diff" | "file" | "command" | "test" | "artifact";
    value: string;
    source: string;
    observedAt?: string;
    sha256?: string;
    exitCode?: number;
  }>;
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
  itemId: string;
  to: string;
  summary: string;
  evidence: Array<string | HandoffEvidence>;
  executorId: string;
  ttlMinutes?: number;
}

export interface GateDecisionInput extends OperationContext {
  itemId: string;
  decision: "approve" | "request-changes" | "reject";
  proof?: SignedOperationProof;
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
  id?: string;
  description: string;
  stage?: string;
  spec?: string;
  runId?: string;
  executorId?: string;
}
export interface LinkItemSpecInput extends OperationContext {
  itemId: string;
  specId: string;
  runId: string;
  executorId: string;
}
export interface UpdateItemInput extends OperationContext {
  itemId: string;
  description?: string;
  tasks?: Array<{ id: string; description: string; done: boolean }>;
}
export interface DeleteItemInput extends OperationContext {
  itemId: string;
}
export interface ReclaimExpiredClaimsInput extends OperationContext {
  actor: string;
  itemId?: string;
}

export const ACTIVE_HEARTBEAT_WINDOW_MS = 90_000;
export function hasLiveClaim(
  item:
    | Partial<
        Pick<
          Item,
          "claimedBy" | "claimExpiresAt" | "activityStatus" | "lastHeartbeatAt"
        >
      >
    | null
    | undefined,
  now = Date.now(),
): boolean {
  if (
    !item?.claimedBy ||
    (item.activityStatus !== "started" && item.activityStatus !== "heartbeat")
  )
    return false;
  const expires = item.claimExpiresAt
    ? Date.parse(item.claimExpiresAt)
    : Number.NaN;
  const heartbeat = item.lastHeartbeatAt
    ? Date.parse(item.lastHeartbeatAt)
    : Number.NaN;
  return (
    Number.isFinite(expires) &&
    expires > now &&
    Number.isFinite(heartbeat) &&
    heartbeat <= now &&
    now - heartbeat <= ACTIVE_HEARTBEAT_WINDOW_MS
  );
}
function evidenceKind(value: string): "file" | "command" {
  const absolute =
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith("/") ||
    value.startsWith("\\");
  const traversal = /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(value);
  // Commands commonly contain package paths. Treat a slash as a file only
  // when the value is path-shaped (no whitespace), or is absolute/traversal.
  return absolute || traversal || (value.includes("/") && !/\s/.test(value))
    ? "file"
    : "command";
}

interface IdempotencyRecord {
  fingerprint: string;
  result: OperationResult;
}
function idempotencyPath(root: string): string {
  return join(getLetraDir(root), "operations", "idempotency.json");
}
function inputFingerprint(input: OperationContext): string {
  return createHash("sha256")
    .update(JSON.stringify(input, Object.keys(input).sort()))
    .digest("hex");
}
// Only reads the run/item selectors from the input, so the revision and
// reason of OperationContext are optional here: callers that compute the
// revision itself (e.g. the board's passage route) have no revision yet.
// Exported so callers send the same revision the operation will compare.
export function directionForOperation(
  root: string,
  input: Partial<OperationContext> & {
    itemId?: string;
    id?: string;
    runId?: string;
  },
): AgentDirectionSnapshot {
  // ITEM-39: one canonical direction. With an active Run this is the
  // *assigned* Run direction (what the claim returns and `letra direction
  // --run/--item` show), no longer the bare Run direction that only the
  // operations used.
  const runId =
    "runId" in input && typeof input.runId === "string" ? input.runId : undefined;
  const itemId =
    "itemId" in input && typeof input.itemId === "string"
      ? input.itemId
      : "id" in input && typeof input.id === "string"
        ? input.id
        : undefined;
  return resolveOperationDirection(root, { runId, itemId });
}

export function directionForRunAwareOperation(
  root: string,
  input: Partial<OperationContext> & {
    itemId: string;
    runId?: string;
    executorId?: string;
  },
): AgentDirectionSnapshot {
  const requestedRunId = input.runId;
  const runs = readExecutionRuns(root).runs;
  const run = requestedRunId
    ? runs.find((candidate) => candidate.id === requestedRunId)
    : runs.filter(
          (candidate) =>
            candidate.itemId === input.itemId &&
            isRunActiveForDirection(candidate),
        ).length === 1
      ? runs.find(
          (candidate) =>
            candidate.itemId === input.itemId &&
            isRunActiveForDirection(candidate),
        )
      : undefined;
  // ITEM-39: the executor is not part of the compared direction. Filtering
  // by it here threw RUN_UNAUTHORIZED (an unhandled crash) when another
  // executor called the passage; the passage's own claim check refuses that
  // case cleanly with CLAIM_REQUIRED.
  if (run) return resolveOperationDirection(root, { runId: run.id });
  return directionForOperation(root, input);
}

function validationDirectionForOperation(
  root: string,
  input: RunValidationInput,
): AgentDirectionSnapshot {
  if (input.runId)
    return resolveDirection(root, {
      runId: input.runId,
      executorId: input.executorId,
    });
  return directionForOperation(root, input);
}
async function withWorkspaceWriteLock<T>(
  root: string,
  action: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withWorkspaceTransactionLock(root, action);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.startsWith("WORKSPACE_TRANSACTION_BUSY") ||
        attempt >= 39
      )
        throw error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
    }
  }
}
function replayIdempotent(
  root: string,
  input: OperationContext,
): OperationResult | null {
  if (!input.idempotencyKey?.trim()) return null;
  try {
    recoverWorkspaceTransaction(root);
    const records = withWorkspaceTransactionLockSync(
      root,
      () =>
        JSON.parse(readFileSync(idempotencyPath(root), "utf8")) as Record<
          string,
          IdempotencyRecord
        >,
    );
    const record = records[input.idempotencyKey];
    if (!record) return null;
    if (record.fingerprint !== inputFingerprint(input))
      return rejected(
        root,
        directionForOperation(root, input),
        "IDEMPOTENCY_KEY_CONFLICT",
        "A chave idempotente já foi usada por outra operação.",
        input,
        { operation: "idempotency" },
      );
    return record.result;
  } catch {
    return null;
  }
}
function rememberIdempotent(
  root: string,
  input: OperationContext,
  value: OperationResult,
): OperationResult {
  if (!input.idempotencyKey?.trim()) return value;
  recoverWorkspaceTransaction(root);
  withWorkspaceTransactionLockSync(root, () => {
    const file = idempotencyPath(root);
    let records: Record<string, IdempotencyRecord> = {};
    try {
      records = JSON.parse(readFileSync(file, "utf8")) as Record<
        string,
        IdempotencyRecord
      >;
    } catch {
      /* first operation */
    }
    records[input.idempotencyKey!] = {
      fingerprint: inputFingerprint(input),
      result: value,
    };
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
    mkdirSync(join(getLetraDir(root), "operations"), { recursive: true });
    writeFileSync(temp, JSON.stringify(records, null, 2), "utf8");
    renameSync(temp, file);
  });
  return value;
}

export function activityOperation(
  root: string,
  itemId?: string,
): AgentDirectionSnapshot["item"] {
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const direction = itemId
    ? resolveAgentDirection(workspaceRoot, itemId)
    : resolveAgentDirection(workspaceRoot);
  if (!itemId) return direction.item;
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find((candidate) => candidate.id === itemId);
  return item
    ? ({ ...item, spec: item.spec ?? null } as AgentDirectionSnapshot["item"])
    : null;
}

export async function createItemOperation(
  root: string,
  input: CreateItemInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    operation: "create_item",
  });
  if (invalid) return invalid;
  return withWorkspaceWriteLock(root, () =>
    createItemOperationLocked(root, input),
  );
}

async function createItemOperationLocked(
  root: string,
  input: CreateItemInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    operation: "create_item",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const run = input.runId
    ? readExecutionRuns(workspaceRoot).runs.find(
        (candidate) => candidate.id === input.runId,
      )
    : undefined;
  const before = run
    ? resolveOperationDirection(workspaceRoot, { runId: run.id })
    : resolveOperationDirection(workspaceRoot, {});
  const subject = { itemId: input.id, operation: "create_item" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Criação de item exige identidade do actor.",
      input,
      subject,
    );
  if (!input.description?.trim())
    return rejected(
      workspaceRoot,
      before,
      "DESCRIPTION_REQUIRED",
      "A descrição do item não pode ficar vazia.",
      input,
      subject,
    );
  if (input.actor.startsWith("mcp:")) {
    const sourceItem = before.item;
    const resolvedActor = sourceItem
      ? resolveMcpActor(
          workspaceRoot,
          input.actor,
          sourceItem.stage,
          input.executorId,
        )
      : input.actor;
    if (
      !run ||
      run.status !== "running" ||
      run.binding.executorId !== input.executorId ||
      run.itemId !== sourceItem?.id
    ) {
      return rejected(
        workspaceRoot,
        before,
        "ACTIVE_RUN_REQUIRED",
        "Criação por agente exige a Run ativa do próprio executor.",
        input,
        subject,
      );
    }
    const expires = sourceItem?.claimExpiresAt
      ? Date.parse(sourceItem.claimExpiresAt)
      : Number.NaN;
    if (
      !sourceItem ||
      sourceItem.claimedBy !== resolvedActor ||
      sourceItem.claimExecutorId !== input.executorId ||
      !Number.isFinite(expires) ||
      expires <= Date.now()
    ) {
      return rejected(
        workspaceRoot,
        before,
        "CLAIM_REQUIRED",
        "O agente precisa possuir um claim vigente na Run informada.",
        input,
        subject,
      );
    }
  } else {
    const humanCheck = requireLocalHumanStrict(
      workspaceRoot,
      input.actor,
      "item.create",
    );
    if (humanCheck)
      return rejected(
        workspaceRoot,
        before,
        "HUMAN_ACTOR_REQUIRED",
        humanCheck,
        input,
        subject,
      );
  }
  const workflow = loadWorkflow(workspaceRoot);
  if (!workflow)
    return rejected(
      workspaceRoot,
      before,
      "WORKFLOW_NOT_FOUND",
      "Workflow não encontrado.",
      input,
      subject,
    );
  const requestedItemId = input.id === undefined ? undefined : input.id.trim();
  if (requestedItemId !== undefined && !requestedItemId)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_ID_INVALID",
      "Quando informado, o ID não pode ficar vazio.",
      input,
      subject,
    );
  const nextNumericId =
    workflow.items.reduce((max, item) => {
      const match = item.id.match(/^ITEM-(\d+)$/);
      return match ? (BigInt(match[1]!) > max ? BigInt(match[1]!) : max) : max;
    }, 0n) + 1n;
  const itemId = requestedItemId ?? `ITEM-${nextNumericId}`;
  if (!/^ITEM-[1-9]\d*$/.test(itemId))
    return rejected(
      workspaceRoot,
      before,
      "ITEM_ID_INVALID",
      "O ID deve seguir o formato ITEM-<número inteiro positivo>.",
      input,
      subject,
    );
  const existing = workflow.items.find((item) => item.id === itemId);
  if (existing)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_EXISTS",
      `O item ${itemId} já existe no estágio ${existing.stage}; nenhum dado foi alterado.`,
      input,
      { itemId, operation: "create_item" },
    );
  const stage = input.stage ?? workflow.stages[0]?.id;
  if (!stage || !workflow.stages.some((candidate) => candidate.id === stage))
    return rejected(
      workspaceRoot,
      before,
      "STAGE_NOT_FOUND",
      "O estágio solicitado não existe no workflow configurado.",
      input,
      subject,
    );
  const specId = input.spec?.trim() || undefined;
  if (specId) {
    if (!/^[a-zA-Z0-9._-]+$/.test(specId))
      return rejected(
        workspaceRoot,
        before,
        "SPEC_ID_INVALID",
        "O nome da spec contém caracteres inválidos.",
        input,
        subject,
      );
    let specPath: string;
    try {
      specPath = createWorkspaceBoundary(getLetraDir(workspaceRoot)).assertPath(
        join(getLetraDir(workspaceRoot), "specs", specId, "spec.md"),
      );
    } catch {
      return rejected(
        workspaceRoot,
        before,
        "SPEC_PATH_INVALID",
        "O caminho da spec está fora do workspace permitido.",
        input,
        subject,
      );
    }
    if (!existsSync(specPath))
      return rejected(
        workspaceRoot,
        before,
        "SPEC_NOT_FOUND",
        `A spec ${specId} não existe no workspace.`,
        input,
        subject,
      );
  }
  const item: Item = {
    id: itemId,
    description: input.description.trim(),
    stage,
    createdAt: new Date().toISOString(),
    tasks: [],
    ...(specId ? { spec: specId } : {}),
  };
  workflow.items.push(item);
  workflow.updatedAt = new Date().toISOString();
  if (specId) {
    workflow.specLinks ??= {};
    workflow.specLinks[specId] ??= { path: `specs/${specId}/spec.md` };
  }
  let write: Awaited<ReturnType<typeof writeWorkflow>>;
  try {
    write = await writeWorkflow(workspaceRoot, {
      workflow,
      source: "mcp-create-item",
      primaryItemId: run?.itemId ?? item.id,
      skipAdapters: true,
      skipEngine: true,
      skipSitrep: true,
      skipLog: true,
      quiet: true,
      expectedRevision: before.revision,
    });
  } catch {
    return rejected(
      workspaceRoot,
      before,
      "ITEM_WRITE_FAILED",
      "Não foi possível persistir o novo item; nenhuma confirmação de sucesso foi emitida.",
      input,
      subject,
    );
  }
  if (!write.ok) {
    const nowWorkflow = loadWorkflow(workspaceRoot);
    const collision = nowWorkflow?.items.find(
      (candidate) => candidate.id === itemId,
    );
    if (collision)
      return rejected(
        workspaceRoot,
        before,
        "ITEM_EXISTS",
        `O item ${itemId} já foi criado por outra requisição; nenhum dado foi sobrescrito.`,
        input,
        { itemId, operation: "create_item" },
      );
    return rejected(
      workspaceRoot,
      before,
      write.error?.startsWith("DIRECTION_STALE")
        ? "DIRECTION_STALE"
        : "ITEM_WRITE_FAILED",
      write.error ?? "Falha ao criar item.",
      input,
      subject,
    );
  }
  const after = run
    ? resolveOperationDirection(workspaceRoot, { runId: run.id })
    : resolveOperationDirection(workspaceRoot, {});
  const entry = audit(workspaceRoot, "item_move", before, {
    outcome: "accepted",
    reasonCode: "ITEM_CREATED",
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
    details: { createdItemId: item.id, requestedSpec: specId ?? null },
  });
  return rememberIdempotent(workspaceRoot, input, {
    ...result(
      before,
      entry.id,
      "accepted",
      "ITEM_CREATED",
      `Item ${item.id} criado no estágio ${stage}.`,
      after,
    ),
    createdItem: {
      id: item.id,
      description: item.description,
      stage: item.stage,
      spec: item.spec,
    },
  });
}

export async function linkItemSpecOperation(
  root: string,
  input: LinkItemSpecInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "link_item_spec",
  });
  if (invalid) return invalid;
  return withWorkspaceWriteLock(root, () =>
    linkItemSpecOperationLocked(root, input),
  );
}

async function linkItemSpecOperationLocked(
  root: string,
  input: LinkItemSpecInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "link_item_spec",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const run = readExecutionRuns(workspaceRoot).runs.find(
    (candidate) => candidate.id === input.runId,
  );
  const before =
    run && isRunActiveForDirection(run)
      ? resolveDirection(workspaceRoot, {
          runId: run.id,
          executorId: input.executorId,
        })
      : resolveAgentDirection(workspaceRoot, input.itemId);
  const subject = { itemId: input.itemId, operation: "link_item_spec" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (
    !run ||
    run.status !== "running" ||
    run.itemId !== input.itemId ||
    run.binding.executorId !== input.executorId ||
    before.item?.id !== input.itemId
  )
    return rejected(
      workspaceRoot,
      before,
      "ACTIVE_RUN_REQUIRED",
      "Vincular spec por agente exige a Run ativa do item e do executor.",
      input,
      subject,
    );
  const resolvedActor = resolveMcpActor(
    workspaceRoot,
    input.actor ?? "",
    before.item!.stage,
    input.executorId,
  );
  const expires = before.item?.claimExpiresAt
    ? Date.parse(before.item.claimExpiresAt)
    : Number.NaN;
  if (
    !before.item ||
    before.item.claimedBy !== resolvedActor ||
    before.item.claimExecutorId !== input.executorId ||
    !Number.isFinite(expires) ||
    expires <= Date.now()
  )
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_REQUIRED",
      "O agente precisa possuir um claim vigente para vincular a spec.",
      input,
      subject,
    );
  if (!/^[a-zA-Z0-9._-]+$/.test(input.specId))
    return rejected(
      workspaceRoot,
      before,
      "SPEC_ID_INVALID",
      "O nome da spec contém caracteres inválidos.",
      input,
      subject,
    );
  let specPath: string;
  try {
    specPath = createWorkspaceBoundary(getLetraDir(workspaceRoot)).assertPath(
      join(getLetraDir(workspaceRoot), "specs", input.specId, "spec.md"),
    );
  } catch {
    return rejected(
      workspaceRoot,
      before,
      "SPEC_PATH_INVALID",
      "O caminho da spec está fora do workspace permitido.",
      input,
      subject,
    );
  }
  if (!existsSync(specPath))
    return rejected(
      workspaceRoot,
      before,
      "SPEC_NOT_FOUND",
      `A spec ${input.specId} não existe no workspace.`,
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  if (!workflow || !item)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      "O item informado não existe.",
      input,
      subject,
    );
  if (item.spec === input.specId) {
    const entry = audit(workspaceRoot, "item_move", before, {
      outcome: "accepted",
      reasonCode: "SPEC_ALREADY_LINKED",
      reason: input.reason,
      actor: input.actor,
      itemId: item.id,
      details: { specId: input.specId },
    });
    return rememberIdempotent(workspaceRoot, input, {
      ...result(
        before,
        entry.id,
        "accepted",
        "SPEC_ALREADY_LINKED",
        `A spec ${input.specId} já está vinculada ao item ${input.itemId}.`,
        before,
      ),
      linkedSpec: input.specId,
    });
  }
  item.spec = input.specId;
  workflow.specLinks ??= {};
  workflow.specLinks[input.specId] ??= {
    path: `specs/${input.specId}/spec.md`,
  };
  workflow.updatedAt = new Date().toISOString();
  const writeRevision = resolveOperationDirection(workspaceRoot, { runId: run.id }).revision;
  let write: Awaited<ReturnType<typeof writeWorkflow>>;
  try {
    write = await writeWorkflow(workspaceRoot, {
      workflow,
      source: "mcp-link-item-spec",
      primaryItemId: item.id,
      skipAdapters: true,
      skipEngine: true,
      skipSitrep: true,
      skipLog: true,
      quiet: true,
      expectedRevision: writeRevision,
    });
  } catch {
    return rejected(
      workspaceRoot,
      before,
      "SPEC_LINK_FAILED",
      "Não foi possível persistir o vínculo da spec; nenhuma confirmação de sucesso foi emitida.",
      input,
      subject,
    );
  }
  if (!write.ok)
    return rejected(
      workspaceRoot,
      before,
      write.error?.startsWith("DIRECTION_STALE")
        ? "DIRECTION_STALE"
        : "SPEC_LINK_FAILED",
      write.error ?? "Falha ao vincular spec.",
      input,
      subject,
    );
  const after = resolveDirection(workspaceRoot, {
    runId: run.id,
    executorId: input.executorId,
  });
  const entry = audit(workspaceRoot, "item_move", before, {
    outcome: "accepted",
    reasonCode: "SPEC_LINKED",
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
    details: { specId: input.specId },
  });
  return rememberIdempotent(workspaceRoot, input, {
    ...result(before, entry.id, "accepted", "SPEC_LINKED", input.reason, after),
    linkedSpec: input.specId,
  });
}

export async function updateItemOperation(
  root: string,
  input: UpdateItemInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "update_item",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "update_item" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Alteração de item exige identidade do actor.",
      input,
      subject,
    );
  const humanCheck = requireLocalHumanStrict(
    workspaceRoot,
    input.actor,
    "item.update",
  );
  if (humanCheck)
    return rejected(
      workspaceRoot,
      before,
      "HUMAN_ACTOR_REQUIRED",
      humanCheck,
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  if (!workflow || !item)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      "Item não encontrado.",
      input,
      subject,
    );
  if (input.description !== undefined) item.description = input.description;
  if (input.tasks !== undefined) item.tasks = input.tasks;
  workflow.updatedAt = new Date().toISOString();
  const write = await writeWorkflow(workspaceRoot, {
    workflow,
    source: "web-ui",
    primaryItemId: item.id,
    skipSitrep: true,
    quiet: true,
    expectedRevision: before.revision,
  });
  if (!write.ok)
    return rejected(
      workspaceRoot,
      before,
      write.error?.startsWith("DIRECTION_STALE")
        ? "DIRECTION_STALE"
        : "ITEM_WRITE_FAILED",
      write.error ?? "Falha ao atualizar item.",
      input,
      subject,
    );
  const after = resolveAgentDirection(workspaceRoot);
  const entry = audit(workspaceRoot, "item_move", before, {
    outcome: "accepted",
    reasonCode: "ITEM_UPDATED",
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(before, entry.id, "accepted", "ITEM_UPDATED", input.reason, after),
  );
}

export async function deleteItemOperation(
  root: string,
  input: DeleteItemInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "delete_item",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "delete_item" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Remoção de item exige identidade do actor.",
      input,
      subject,
    );
  const humanCheck = requireLocalHumanStrict(
    workspaceRoot,
    input.actor,
    "item.delete",
  );
  if (humanCheck)
    return rejected(
      workspaceRoot,
      before,
      "HUMAN_ACTOR_REQUIRED",
      humanCheck,
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const index =
    workflow?.items.findIndex((candidate) => candidate.id === input.itemId) ??
    -1;
  if (!workflow || index < 0)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      "Item não encontrado.",
      input,
      subject,
    );
  workflow.items.splice(index, 1);
  workflow.updatedAt = new Date().toISOString();
  const write = await writeWorkflow(workspaceRoot, {
    workflow,
    source: "web-ui",
    skipSitrep: true,
    quiet: true,
    expectedRevision: before.revision,
  });
  if (!write.ok)
    return rejected(
      workspaceRoot,
      before,
      write.error?.startsWith("DIRECTION_STALE")
        ? "DIRECTION_STALE"
        : "ITEM_WRITE_FAILED",
      write.error ?? "Falha ao remover item.",
      input,
      subject,
    );
  const after = directionForOperation(workspaceRoot, input);
  const entry = audit(workspaceRoot, "item_move", before, {
    outcome: "accepted",
    reasonCode: "ITEM_DELETED",
    reason: input.reason,
    actor: input.actor,
    itemId: input.itemId,
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(before, entry.id, "accepted", "ITEM_DELETED", input.reason, after),
  );
}

export async function submitEvidenceOperation(
  root: string,
  input: EvidenceInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "submit_evidence",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "submit_evidence" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  const item = loadWorkflow(workspaceRoot)?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  const resolvedEvidenceActor = resolveMcpActor(
    workspaceRoot,
    (input.actor ?? "").trim(),
    item?.stage ?? "",
  );
  const evidenceExpired =
    !item?.claimExpiresAt ||
    !Number.isFinite(Date.parse(item.claimExpiresAt)) ||
    Date.now() >= Date.parse(item.claimExpiresAt);
  const ownsClaim =
    Boolean(item?.claimedBy) &&
    item?.claimedBy === resolvedEvidenceActor &&
    item?.claimExecutorId === input.executorId;
  if (!item || !ownsClaim || evidenceExpired)
    return rejected(
      workspaceRoot,
      before,
      // Only the caller's own lapsed lease is "expired"; no claim, or someone
      // else's, is a missing claim (it used to read as CLAIM_EXPIRED).
      ownsClaim && evidenceExpired ? "CLAIM_EXPIRED" : "CLAIM_REQUIRED",
      "A evidência exige claim vigente, com actor, executor e lease válido.",
      input,
      subject,
    );
  const boundary = createWorkspaceBoundary(
    resolveWorkspaceRoot(root).workspaceDir,
  );
  for (const evidence of input.evidence) {
    if (!evidence.source?.trim() || !evidence.value?.trim())
      return rejected(
        workspaceRoot,
        before,
        "EVIDENCE_INVALID",
        "Evidência exige origem e valor.",
        input,
        subject,
      );
    if (
      evidence.kind === "file" ||
      evidence.kind === "diff" ||
      evidence.kind === "artifact"
    ) {
      try {
        const path = boundary.assertPath(evidence.value);
        if (existsSync(path) && statSync(path).isSymbolicLink())
          throw new Error("symlink");
      } catch {
        return rejected(
          workspaceRoot,
          before,
          "EVIDENCE_PATH_OUTSIDE_WORKSPACE",
          "Path da evidência fora do workspace autorizado.",
          input,
          subject,
        );
      }
    }
  }
  const entry = audit(workspaceRoot, "agent_execution_event", before, {
    outcome: "accepted",
    reasonCode: "EVIDENCE_ACCEPTED",
    reason: input.reason,
    actor: input.actor,
    itemId: input.itemId,
    details: {
      evidence: input.evidence.map((e) => ({
        ...e,
        observedAt: e.observedAt ?? new Date().toISOString(),
        sha256: e.sha256 ?? createHash("sha256").update(e.value).digest("hex"),
      })),
    },
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(
      before,
      entry.id,
      "accepted",
      "EVIDENCE_ACCEPTED",
      input.reason,
      directionForOperation(workspaceRoot, input),
    ),
  );
}

export async function requestHandoffOperation(
  root: string,
  input: HandoffInput,
): Promise<OperationResult> {
  return requestPassageOperation(root, input);
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
      adapter: auditAdapter(input.actor),
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
  extra: Pick<
    OperationResult,
    "validation" | "workspace" | "securityReview"
  > = {},
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

/**
 * What the caller should run next after a refusal (spec recusas-que-ensinam
 * AC4). `humanRequired` marks steps only a human may take: the command is then
 * one the agent may run (a diagnosis or a query), never one carrying a human
 * identity.
 */
export interface RefusalGuidance {
  nextCommand?: string;
  humanRequired?: boolean;
}

/** Default next step: re-read the direction the operation compared. */
function directionQueryCommand(
  direction: AgentDirectionSnapshot,
  itemId?: string,
): string {
  const runId =
    direction.assignment?.status === "assigned"
      ? direction.assignment.runId
      : undefined;
  if (runId) return `letra direction --run ${runId} --json`;
  const target = itemId ?? direction.item?.id;
  return target
    ? `letra direction --item ${target} --json`
    : "letra direction --json";
}

/** Double-quoted shell argument that survives bash and PowerShell. */
function shellArg(value: string): string {
  return `"${value.replace(/["`$\\]/g, "")}"`;
}

/** The claim to retry, with the values the refusal says are accepted. */
function claimCommand(
  itemId: string,
  actor: string,
  capability: string,
  input: { executorId: string; reason: string },
  revision: string,
): string {
  return `letra operation claim ${itemId} --actor ${actor} --executor ${input.executorId} --capability ${capability} --expected-revision ${revision} --reason ${shellArg(input.reason)}`;
}

function rejected(
  root: string,
  direction: AgentDirectionSnapshot,
  reasonCode: string,
  reason: string,
  context: OperationContext,
  subject: { itemId?: string; acId?: string; operation: string },
  guidance: RefusalGuidance = {},
): OperationResult {
  const workspace = invalidWorkspaceDiagnostic(root);
  if (workspace) {
    return {
      ...result(
        direction,
        "audit-unavailable:workspace-link-invalid",
        "rejected",
        "WORKSPACE_LINK_INVALID",
        "O .letra-link não aponta para um workspace canônico válido; nenhuma operação foi executada.",
        direction,
        { workspace },
      ),
      nextCommand: "letra doctor",
      humanRequired: false,
    };
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
  const derived =
    (reasonCode === "CLAIM_REQUIRED" || reasonCode === "CLAIM_EXPIRED") &&
    !guidance.nextCommand
      ? claimRequiredGuidance(root, direction, context, subject.itemId)
      : {};
  return {
    ...result(direction, entry.id, "rejected", reasonCode, reason),
    recoveryActions: recoveryActionsFor(reasonCode),
    nextCommand:
      guidance.nextCommand ??
      derived.nextCommand ??
      directionQueryCommand(direction, subject.itemId),
    humanRequired:
      guidance.humanRequired ?? HUMAN_ONLY_REFUSALS.has(reasonCode),
  };
}

/** Refusals whose only way forward is a human decision or identity. */
const HUMAN_ONLY_REFUSALS = new Set([
  "HUMAN_APPROVAL_REQUIRED",
  "HUMAN_ACTOR_REQUIRED",
  // Signed operations (gate decision, Run migration) need the human's key.
  "SIGNED_OPERATION_REQUIRED",
]);

/**
 * CLAIM_REQUIRED is raised by many operations; the claim to take follows from
 * the item's stage: the caller's role when it staffs the stage, otherwise the
 * stage's first role, with that role's first capability.
 */
function claimRequiredGuidance(
  root: string,
  direction: AgentDirectionSnapshot,
  context: OperationContext,
  itemId: string | undefined,
): RefusalGuidance {
  const executorId = (context as { executorId?: unknown }).executorId;
  const item = direction.item;
  if (!itemId || !item || typeof executorId !== "string" || !executorId)
    return {};
  try {
    const flow = resolveActiveFlow(root, {
      itemId,
      workflowVersionId: item.workflowVersionId ?? undefined,
    }).flow;
    const stage = flow?.stages.find((candidate) => candidate.id === item.stage);
    const roleIds = stage?.roleIds.length ? stage.roleIds : (stage?.agents ?? []);
    const role =
      roleIds.find((roleId) => roleId === context.actor) ?? roleIds[0];
    const capability = flow?.roles.find((candidate) => candidate.id === role)
      ?.capabilities[0];
    if (!role || !capability) return {};
    return {
      nextCommand: claimCommand(
        itemId,
        role,
        capability,
        { executorId, reason: context.reason },
        direction.revision,
      ),
    };
  } catch {
    return {};
  }
}

function recoveryActionsFor(reasonCode: string): string[] {
  const actions: Record<string, string[]> = {
    TRANSITION_NOT_CONFIGURED: [
      "Consulte as transições da versão vinculada; escolha uma aresta configurada ou solicite revisão humana do workflow.",
    ],
    PENDING_ACCEPTANCE_CRITERIA: [
      "Conclua o AC pendente com evidência ou solicite retrabalho ao reviewer.",
    ],
    BLOCKING_GATE: [
      "Execute o precheck configurado ou solicite a decisão humana do gate; não force a transição.",
    ],
    HUMAN_APPROVAL_REQUIRED: [
      "Aguarde a decisão humana autenticada no gate configurado.",
    ],
    DESTINATION_EXECUTOR_NOT_ELIGIBLE: [
      "Verifique bindings e disponibilidade de executores para o papel e estágio de destino.",
    ],
    NO_COMPATIBLE_EXECUTOR: [
      "Registre ou disponibilize um executor compatível com as capabilities configuradas.",
    ],
    DIRECTION_STALE: [
      "Consulte novamente letra direction e repita a operação com a revisão vigente.",
    ],
    HANDOFF_EXPIRED: [
      "Solicite um novo handoff pelo fluxo canônico; o handoff vencido permanece no histórico.",
    ],
    CLAIM_EXPIRED: [
      "Renove o claim por operação canônica e repita a operação.",
    ],
  };
  return (
    actions[reasonCode] ?? [
      "Consulte a direção vigente e corrija a condição indicada antes de repetir a operação.",
    ]
  );
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
  // ITEM-39 AC4/AC5: say which direction was compared and how to get it, so
  // the caller does not have to guess between workspace, item and Run.
  const runId =
    direction.assignment?.status === "assigned" ? direction.assignment.runId : undefined;
  const itemId = subject.itemId ?? direction.item?.id;
  const scope = runId ? `Run ${runId}` : itemId ? `item ${itemId}` : "workspace";
  const command = runId
    ? `letra direction --run ${runId} --json`
    : itemId
      ? `letra direction --item ${itemId} --json`
      : "letra direction --json";
  let sentWorkspaceRevision = false;
  if (itemId) {
    try {
      sentWorkspaceRevision =
        context.expectedRevision === resolveOperationDirection(root, {}).revision;
    } catch {
      sentWorkspaceRevision = false;
    }
  }
  const reason = sentWorkspaceRevision
    ? `A revisão enviada é a da direção de workspace (letra direction sem --item); esta operação compara a direção do ${scope}, revisão vigente ${direction.revision}. Consulte com: ${command}`
    : `A direção do ${scope} mudou desde a última consulta (revisão vigente ${direction.revision}). Consulte com: ${command}`;
  const refused = rejected(root, direction, "DIRECTION_STALE", reason, context, subject);
  return { ...refused, recoveryActions: [`Consulte ${command} e repita a operação com a revisão vigente.`] };
}

function normalizeAcId(value: string): string {
  const match = value
    .trim()
    .match(/^AC(?:[\s-]?gap[\s-]?(\d+(?:\.\d+)*)|[\s-]?(\d+(?:\.\d+)*))$/i);
  return match
    ? match[1]
      ? `AC-gap-${match[1]}`
      : `AC${match[2]}`
    : value.trim().toUpperCase();
}

function resolveDecisionTargetStage(
  stages: Array<{ id: string }>,
  current: string,
  target: string,
): string | null {
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
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "claim",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "claim" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Claim exige identidade do actor.",
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  if (!workflow || !item)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      "Item não encontrado.",
      input,
      subject,
    );
  const flow = resolveActiveFlow(workspaceRoot, {
    itemId: item.id,
    workflowVersionId: item.workflowVersionId,
  }).flow;
  const stage = flow?.stages.find((candidate) => candidate.id === item.stage);
  if (stage?.zone === "done")
    return rejected(
      workspaceRoot,
      before,
      "ITEM_COMPLETED",
      "Cannot claim a completed item.",
      input,
      subject,
    );
  if (!before.item || before.item.id !== input.itemId)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_CURRENT",
      "O claim exige o item vigente.",
      input,
      subject,
    );

  // The workflow authorizes the role; executor bindings are not an eligibility gate.
  const requestedActor = input.actor.trim();
  const workflowRoles = flow?.roles ?? [];
  const stageRoles =
    stage?.roles ??
    workflowRoles.filter((role) => stage?.agents.includes(role.id));
  const mcpRoleCandidates = stageRoles.filter((role) =>
    role.capabilities.includes(input.capability),
  );
  const actorForClaim = requestedActor.startsWith("mcp:")
    ? item.handoff &&
      [...workflowRoles, ...stageRoles].some(
        (role) => role.id === item.handoff?.to,
      )
      ? item.handoff.to
      : mcpRoleCandidates.length === 1
        ? mcpRoleCandidates[0]!.id
        : requestedActor
    : requestedActor;
  const handoffExpiresAt = item.handoff?.expiresAt
    ? Date.parse(item.handoff.expiresAt)
    : Number.NaN;
  const activeHandoff = Boolean(
    item.handoff &&
    Number.isFinite(handoffExpiresAt) &&
    handoffExpiresAt > Date.now(),
  );
  // An accepted handoff has already been consumed by its recipient; its expiry
  // must not block that recipient from renewing the claim afterwards.
  // AC2/AC3/AC4: refusals below rebuild the claim with the accepted values.
  // A refusal changes nothing, so `before.revision` is still current.
  const roleCapabilities = (roleId: string): string[] =>
    stageRoles.find((role) => role.id === roleId)?.capabilities ??
    workflowRoles.find((role) => role.id === roleId)?.capabilities ??
    [];
  const retryClaim = (actor: string, capability: string): RefusalGuidance => ({
    nextCommand: claimCommand(item.id, actor, capability, input, before.revision),
  });
  // ITEM-56: expiry ends the reservation, not the handoff. Its recipient may
  // still take it (a late acceptance, audited); other stage roles may claim
  // too once the reservation lapsed. Only a handoff waiting on a human stays
  // closed to agents: the lapsed deadline does not hand the decision over.
  const lapsedHandoff =
    item.handoff && item.handoff.status !== "accepted" && !activeHandoff
      ? item.handoff
      : undefined;
  if (
    lapsedHandoff?.to.startsWith("human") &&
    !actorForClaim.startsWith("human")
  )
    return rejected(
      workspaceRoot,
      before,
      "HANDOFF_EXPIRED",
      `O item aguarda decisão de ${lapsedHandoff.to} (handoff de ${lapsedHandoff.from}, prazo vencido em ${lapsedHandoff.expiresAt}); o prazo vencido não transfere a decisão para um agente.`,
      input,
      subject,
      { humanRequired: true },
    );
  const lateRecipient = lapsedHandoff?.to === actorForClaim;
  const activeHandoffForActor =
    (activeHandoff && item.handoff?.to === actorForClaim) || lateRecipient;
  if (activeHandoff && item.handoff && item.handoff.to !== actorForClaim) {
    const recipient = item.handoff.to;
    const recipientCapabilities = roleCapabilities(recipient);
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_NOT_ALLOWED",
      `Handoff ativo direcionado ao papel ${recipient}; o claim deve usar --actor ${recipient}${recipientCapabilities.length ? ` com uma capability do papel (${recipientCapabilities.join(", ")})` : ""}.`,
      input,
      subject,
      recipient.startsWith("human")
        ? { humanRequired: true }
        : retryClaim(
            recipient,
            recipientCapabilities.includes(input.capability)
              ? input.capability
              : (recipientCapabilities[0] ?? input.capability),
          ),
    );
  }
  const isCurrentHandoffRecipient = activeHandoffForActor;
  const claimIdentityId = requestedActor.startsWith("mcp:")
    ? requestedActor
    : actorForClaim;
  if (isCurrentHandoffRecipient && item.handoff) {
    const acceptedAt = new Date();
    item.handoff.status = "accepted";
    item.handoff.acceptedAt = acceptedAt.toISOString();
    if (lateRecipient) {
      item.handoff.lateAcceptance = true;
      item.handoff.lateByMinutes = Math.max(
        0,
        Math.round((acceptedAt.getTime() - handoffExpiresAt) / 60_000),
      );
    }
  }
  if (
    stage?.agents.length &&
    !stage.agents.includes(actorForClaim) &&
    !isCurrentHandoffRecipient
  ) {
    // Prefer the stage role that already holds the requested capability.
    const suggested =
      stage.agents.find((roleId) =>
        roleCapabilities(roleId).includes(input.capability),
      ) ?? stage.agents[0] ?? actorForClaim;
    const suggestedCapabilities = roleCapabilities(suggested);
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_NOT_ALLOWED",
      `Actor não autorizado no estágio ${stage.id}: ${input.actor}. Papéis aceitos (use o id do papel em --actor): ${stage.agents.join(", ")}.`,
      input,
      subject,
      retryClaim(
        suggested,
        suggestedCapabilities.includes(input.capability)
          ? input.capability
          : (suggestedCapabilities[0] ?? input.capability),
      ),
    );
  }
  const capabilities = roleCapabilities(actorForClaim);
  if (capabilities.length > 0 && !capabilities.includes(input.capability)) {
    const roleVocabulary = new Set(
      [...workflowRoles, ...stageRoles].flatMap((role) => role.capabilities),
    );
    const vocabularyHint = roleVocabulary.has(input.capability)
      ? ""
      : ` "${input.capability}" não é capability de nenhum papel do flow: o claim usa o vocabulário do papel, não o do registro de executores.`;
    return rejected(
      workspaceRoot,
      before,
      "CAPABILITY_INVALID",
      `Capability não permitida para ${actorForClaim}: ${input.capability}. Capabilities do papel: ${capabilities.join(", ")}.${vocabularyHint}`,
      input,
      subject,
      retryClaim(actorForClaim, capabilities[0] ?? input.capability),
    );
  }
  const claimHooks = (stage?.hooks?.on_enter ?? []).filter(
    (hook) => hook.auto && hook.requiresClaim,
  );
  for (const hook of claimHooks) {
    if (hook.action === "capture_baseline") continue;
    const operation = flow?.operations[hook.action];
    if (!operation) {
      return rejected(
        workspaceRoot,
        before,
        "HOOK_OPERATION_NOT_CONFIGURED",
        `O hook automático "${hook.action}" não possui operação declarada no flow.`,
        input,
        subject,
      );
    }
    if (
      !operation.allowedInStages.includes("*") &&
      !operation.allowedInStages.includes(item.stage)
    ) {
      return rejected(
        workspaceRoot,
        before,
        "HOOK_STAGE_NOT_ALLOWED",
        `O hook automático "${hook.action}" não é permitido no estágio "${item.stage}".`,
        input,
        subject,
      );
    }
    if (
      operation.requiredCapability &&
      operation.requiredCapability !== input.capability
    ) {
      return rejected(
        workspaceRoot,
        before,
        "CAPABILITY_INVALID",
        `O hook automático "${hook.action}" exige a capability "${operation.requiredCapability}".`,
        input,
        subject,
      );
    }
  }
  const claimExpired = item.claimExpiresAt
    ? Date.now() >= Date.parse(item.claimExpiresAt)
    : false;
  if (
    item.claimedBy &&
    !claimExpired &&
    (item.claimedBy !== actorForClaim ||
      item.claimExecutorId !== input.executorId)
  )
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_CONFLICT",
      `Item já está sob responsabilidade de ${item.claimedBy}.`,
      input,
      subject,
    );
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
  // Claiming a stage that captures the pre-Code baseline captures it when it is
  // missing or incomplete: no change has been made under this claim yet, and a
  // partial baseline can never validate a Security review.
  const capturesBaseline = (stage?.hooks?.on_enter ?? []).some(
    (hook) => hook.auto && hook.action === "capture_baseline",
  );
  if (capturesBaseline && !isUsableBaseline(item.securityBaseline))
    item.securityBaseline = captureSecurityBaseline(
      securityExecutionRoot(workspaceRoot, workflow),
    );
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
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_WRITE_FAILED",
      writeResult.error ?? "Falha ao persistir claim.",
      input,
      subject,
    );
  let after = directionForOperation(workspaceRoot, input);
  let claimedRun: RunEntity | undefined;
  if (item.workflowVersionId) {
    const nowIso = now.toISOString();
    const runStore = readExecutionRuns(workspaceRoot);
    const priorRun = runStore.runs.find(
      (run) =>
        run.itemId === item.id &&
        (run.status === "running" ||
          run.status === "queued" ||
          run.status === "waiting-human"),
    );
    const lease = {
      expiresAt: item.claimExpiresAt!,
      heartbeatAt: nowIso,
      ttlMinutes: ttl,
    };
    try {
      let runId: string;
      if (priorRun) {
        const resumed = updateExecutionRun(
          workspaceRoot,
          priorRun.id,
          priorRun.revision,
          (run) => ({
            ...run,
            binding: {
              actorId: actorForClaim,
              identityId: claimIdentityId,
              roleId: actorForClaim,
              executorId: input.executorId.trim(),
            },
            authorization: {
              kind: isCurrentHandoffRecipient ? "handoff" : "claim",
              actorId: actorForClaim,
              referenceId: isCurrentHandoffRecipient
                ? `handoff:${item.id}:${item.handoff?.timestamp ?? nowIso}`
                : `claim:${item.id}:${nowIso}`,
              grantedAt: nowIso,
              revision: before.revision,
            },
            workflowStageId: item.stage,
            cycle:
              run.cycle.endedAt !== null
                ? {
                    number: run.cycle.number + 1,
                    startedAt: nowIso,
                    endedAt: null,
                  }
                : run.cycle,
            lease,
            revision: run.revision + 1,
            directionRevision: after.revision,
            updatedAt: nowIso,
            status: "running",
            result: null,
          }),
        );
        runId = resumed.id;
      } else {
        runId = `run-${randomUUID()}`;
        const run: RunEntity = {
          id: runId,
          workspaceId: resolveWorkspaceRoot(workspaceRoot).workspaceRoot,
          itemId: item.id,
          binding: {
            actorId: actorForClaim,
            identityId: claimIdentityId,
            roleId: actorForClaim,
            executorId: input.executorId.trim(),
          },
          authorization: {
            kind: isCurrentHandoffRecipient ? "handoff" : "claim",
            actorId: actorForClaim,
            referenceId: isCurrentHandoffRecipient
              ? `handoff:${item.id}:${item.handoff?.timestamp ?? nowIso}`
              : `claim:${item.id}:${nowIso}`,
            grantedAt: nowIso,
            revision: before.revision,
          },
          workflowVersionId: item.workflowVersionId,
          workflowStageId: item.stage,
          cycle: { number: 1, startedAt: nowIso, endedAt: null },
          lease,
          revision: 1,
          directionRevision: after.revision,
          createdAt: nowIso,
          updatedAt: nowIso,
          result: null,
          handoffs: [],
          gateDecisions: [],
          evidence: [],
          status: "running",
        };
        createExecutionRun(workspaceRoot, run);
      }
      claimedRun = readExecutionRuns(workspaceRoot).runs.find(
        (run) => run.id === runId,
      );
      after = resolveDirection(workspaceRoot, {
        runId,
        executorId: input.executorId,
      });
    } catch (error) {
      return rejected(
        workspaceRoot,
        before,
        "RUN_CLAIM_WRITE_FAILED",
        error instanceof Error
          ? error.message
          : "Falha ao persistir a Run do claim.",
        input,
        subject,
      );
    }
  }
  const entry = audit(workspaceRoot, "agent_claim_requested", before, {
    outcome: "accepted",
    reasonCode: "CLAIM_ACCEPTED",
    reason: input.reason,
    actor: actorForClaim,
    itemId: item.id,
    details: {
      executorId: input.executorId,
      capability: input.capability,
      ttlMinutes: ttl,
      expiresAt: item.claimExpiresAt,
      originalActor: input.actor,
      runId: claimedRun?.id,
      runRevision: claimedRun?.revision,
      cycle: claimedRun?.cycle.number,
      ...(lateRecipient
        ? {
            lateAcceptance: true,
            lateByMinutes: item.handoff?.lateByMinutes,
            handoffExpiresAt: item.handoff?.expiresAt,
          }
        : {}),
    },
  });
  for (const hook of claimHooks) {
    if (hook.action === "capture_baseline") continue;
    if (hook.action === "security_review") {
      const hookInput: SecurityReviewInput = {
        itemId: item.id,
        executorId: input.executorId,
        actor: actorForClaim,
        expectedRevision: "",
        reason: `Hook automático on_enter: ${hook.action}`,
        idempotencyKey: input.idempotencyKey
          ? `${input.idempotencyKey}:${hook.action}`
          : undefined,
      };
      // The hook checks its revision with directionForOperation, which is not the
      // view `after` was built from; give it the revision of its own view.
      hookInput.expectedRevision = directionForOperation(workspaceRoot, hookInput).revision;
      const hookResult = await runSecurityReviewOperation(workspaceRoot, hookInput);
      after = hookResult.nextDirection;
      if (hookResult.outcome !== "accepted") {
        return rememberIdempotent(
          workspaceRoot,
          input,
          result(
            before,
            entry.id,
            hookResult.outcome,
            hookResult.reasonCode,
            hookResult.reason,
            after,
            { securityReview: hookResult.securityReview },
          ),
        );
      }
      continue;
    }
    return rememberIdempotent(
      workspaceRoot,
      input,
      result(
        before,
        entry.id,
        "rejected",
        "HOOK_ACTION_UNSUPPORTED",
        `O hook automático "${hook.action}" não possui executor registrado.`,
        after,
      ),
    );
  }
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(before, entry.id, "accepted", "CLAIM_ACCEPTED", input.reason, after),
  );
}

export async function recordExecutionEvent(
  root: string,
  input: ExecutionEventInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: input.status,
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: input.status };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Evento exige identidade do actor.",
      input,
      subject,
    );
  if (!before.item || before.item.id !== input.itemId)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_CURRENT",
      "Evento exige o item vigente.",
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  if (!workflow || !item)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      "Item não encontrado.",
      input,
      subject,
    );
  const resolvedEventActor = resolveMcpActor(
    workspaceRoot,
    (input.actor ?? "").trim(),
    item.stage,
  );
  const expired =
    !item.claimExpiresAt || Date.now() >= Date.parse(item.claimExpiresAt);
  if (
    item.claimedBy !== resolvedEventActor ||
    item.claimExecutorId !== input.executorId
  )
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_REQUIRED",
      "Actor e executor precisam possuir o claim vigente.",
      input,
      subject,
    );
  if (expired)
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_EXPIRED",
      "O lease do claim expirou; faça um novo claim.",
      input,
      subject,
    );
  const nowDate = new Date();
  const now = nowDate.toISOString();
  item.activityStatus = input.status;
  if (input.status === "started") item.activityStartedAt = now;
  if (input.status === "heartbeat" || input.status === "started")
    item.lastHeartbeatAt = now;
  if (input.status === "heartbeat")
    item.claimExpiresAt = new Date(
      nowDate.getTime() + (item.claimTtlMinutes ?? 30) * 60_000,
    ).toISOString();
  if (input.status === "started" || input.status === "succeeded")
    item.lastFailure = undefined;
  if (input.status === "succeeded" && item.handoff)
    item.handoff.status = "completed";
  if (input.status === "failed")
    item.lastFailure = {
      code: input.errorCode ?? "EXECUTION_FAILED",
      message: input.message ?? "Execução falhou.",
      recovery: input.recovery ?? "human",
      at: now,
    };
  workflow.updatedAt = now;
  const writeResult = await writeWorkflow(workspaceRoot, {
    workflow,
    source: "flow-claim",
    primaryItemId: item.id,
    skipSitrep: true,
    skipLog: true,
    quiet: true,
    confineAdapterWrites: true,
    expectedRevision: before.revision,
  });
  if (!writeResult.ok)
    return rejected(
      workspaceRoot,
      before,
      "EVENT_WRITE_FAILED",
      writeResult.error ?? "Falha ao persistir evento.",
      input,
      subject,
    );
  let after = directionForOperation(workspaceRoot, input);
  const run = readExecutionRuns(workspaceRoot).runs.find(
    (entry) =>
      entry.itemId === item.id &&
      entry.binding.executorId === input.executorId &&
      entry.status === "running",
  );
  if (run) {
    const terminal = input.status === "succeeded" || input.status === "failed";
    try {
      const updated = updateExecutionRun(
        workspaceRoot,
        run.id,
        run.revision,
        (current) => ({
          ...current,
          lease: terminal
            ? null
            : {
                expiresAt:
                  item.claimExpiresAt ?? current.lease?.expiresAt ?? now,
                heartbeatAt: now,
                ttlMinutes:
                  item.claimTtlMinutes ?? current.lease?.ttlMinutes ?? 30,
              },
          cycle: terminal ? { ...current.cycle, endedAt: now } : current.cycle,
          revision: current.revision + 1,
          directionRevision: after.revision,
          updatedAt: now,
          status: input.status === "failed" ? "failed" : "running",
          result:
            input.status === "succeeded" || input.status === "failed"
              ? {
                  outcome:
                    input.status === "succeeded" ? "succeeded" : "failed",
                  finishedAt: now,
                  summary: input.message,
                  evidenceIds: current.evidence.map((evidence) => evidence.id),
                }
              : current.result,
        }),
      );
      after = resolveOperationDirection(workspaceRoot, { runId: updated.id });
    } catch (error) {
      return rejected(
        workspaceRoot,
        before,
        "RUN_EVENT_WRITE_FAILED",
        error instanceof Error
          ? error.message
          : "Falha ao persistir evento na Run.",
        input,
        subject,
      );
    }
  }
  const currentRun = run
    ? readExecutionRuns(workspaceRoot).runs.find((entry) => entry.id === run.id)
    : undefined;
  const entry = audit(workspaceRoot, "agent_execution_event", before, {
    outcome: "accepted",
    reasonCode: "EVENT_RECORDED",
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
    details: {
      status: input.status,
      executorId: input.executorId,
      message: input.message,
      recovery: input.recovery,
      errorCode: input.errorCode,
      runId: currentRun?.id,
      runRevision: currentRun?.revision,
      cycle: currentRun?.cycle.number,
    },
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(before, entry.id, "accepted", "EVENT_RECORDED", input.reason, after),
  );
}

function markPendingAc(content: string, acId: string): string | null {
  const lines = content.split("\n");
  const expected = normalizeAcId(acId);
  const index = lines.findIndex((line) => {
    if (!/^\s*-\s*\[ \]\s*\*\*/.test(line)) return false;
    const label = line.match(/\*\*([^*]+)\*\*/)?.[1] ?? "";
    const id = label.match(
      /\bAC(?:[\s-]?gap[\s-]?(\d+(?:\.\d+)*)|[\s-]?(\d+(?:\.\d+)*))\b/i,
    );
    return id ? normalizeAcId(id[0]) === expected : false;
  });
  if (index < 0) return null;
  lines[index] = lines[index].replace(/\[ \]/, "[x]");
  return lines.join("\n");
}

export async function runValidationOperation(
  root: string,
  context: RunValidationInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, context, {
    operation: "validate",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, context);
  if (replay) return replay;
  const before = validationDirectionForOperation(workspaceRoot, context);
  const stale = checkRevision(workspaceRoot, before, context, {
    operation: "validate",
  });
  if (stale) return stale;
  const persistenceRevision = directionForOperation(
    workspaceRoot,
    context,
  ).revision;

  const validation = await validate(workspaceRoot, {
    format: "silent",
    exit: false,
    log: false,
  });
  const workflow = loadWorkflow(workspaceRoot);
  const item =
    before.item &&
    workflow?.items.find((candidate) => candidate.id === before.item?.id);
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
      expectedRevision: persistenceRevision,
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
    // Validation updates only runtime evidence in workflow.json. Refresh the
    // generated catalog afterward so its mtime does not make the next
    // validation falsely report CATALOG_STALE for this non-catalog change.
    try {
      const { writeSpecCatalog } = await import("../spec-catalog/service.js");
      writeSpecCatalog(workspaceRoot, workflow);
    } catch {
      return rejected(
        workspaceRoot,
        before,
        "CATALOG_REFRESH_FAILED",
        "A validação foi registrada, mas não foi possível atualizar o catálogo derivado.",
        context,
        { itemId: item.id, operation: "validate" },
      );
    }
  }
  const after = validationDirectionForOperation(workspaceRoot, context);
  const entry = audit(workspaceRoot, "agent_validation_run", before, {
    outcome: validation.failed === 0 ? "accepted" : "rejected",
    reasonCode:
      validation.failed === 0 ? "VALIDATION_COMPLETED" : "VALIDATION_FAILED",
    reason: context.reason,
    actor: context.actor,
    itemId: before.item?.id,
    details: { validation, evidence: item?.validation },
  });
  return rememberIdempotent(
    workspaceRoot,
    context,
    result(
      before,
      entry.id,
      validation.failed === 0 ? "accepted" : "rejected",
      validation.failed === 0 ? "VALIDATION_COMPLETED" : "VALIDATION_FAILED",
      context.reason,
      after,
      { validation },
    ),
  );
}

function securityPolicyFor(root: string): {
  blockOnCritical: boolean;
  blockOnHigh: boolean;
} {
  const harness = loadHarness(
    resolveHarnessRoot(root, DEFAULT_HARNESS_VERSION),
  );
  const workflow = loadWorkflow(root);
  const policyId = workflow?.template
    ? harness?.flows[workflow.template]?.defaultPolicy
        ?.replace(/^.*[\\/]/, "")
        .replace(/\.json$/, "")
    : "sdlc-default";
  const policy = policyId ? harness?.policies[policyId]?.security : undefined;
  return {
    blockOnCritical: policy?.blockOnCritical ?? true,
    blockOnHigh: policy?.blockOnHigh ?? true,
  };
}

function securityExecutionRoot(root: string, workflow: Workflow): string {
  const execution = resolveExecutionWorkspace({
    workflow,
    workspaceRoot: root,
  });
  return execution.ok ? execution.root : resolveSecurityExecutionRoot(root);
}

/**
 * Runs the automatic, claim-free on_enter hooks of a stage the item has just
 * entered. Passage runs them inline; gate decisions and rework also move items
 * between stages and must not skip them (e.g. the pre-Code security baseline).
 */
function runClaimFreeEnterHooks(
  root: string,
  workflow: Workflow,
  item: Workflow["items"][number],
  stage: { hooks?: { on_enter?: Array<{ action: string; auto?: boolean; requiresClaim?: boolean }> } } | undefined,
): void {
  for (const hook of stage?.hooks?.on_enter ?? []) {
    if (!hook.auto || hook.requiresClaim) continue;
    if (hook.action === "capture_baseline" && !isUsableBaseline(item.securityBaseline))
      item.securityBaseline = captureSecurityBaseline(
        securityExecutionRoot(root, workflow),
      );
  }
}

/** A baseline the Security review can validate: complete file and dependency snapshots. */
function isUsableBaseline(
  baseline: Workflow["items"][number]["securityBaseline"],
): boolean {
  return Boolean(
    baseline?.capturedAt &&
      baseline.fileSnapshotComplete === true &&
      baseline.dependencySnapshotComplete === true,
  );
}

/** Execute and persist the one canonical item-scoped Security report. */
export async function runSecurityReviewOperation(
  root: string,
  input: SecurityReviewInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "security_review",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "security_review" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Revisão de Security exige identidade do actor.",
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  if (!workflow || !item)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      "Item não encontrado.",
      input,
      subject,
    );
  const resolvedSecurityActor = resolveMcpActor(
    workspaceRoot,
    (input.actor ?? "").trim(),
    item.stage,
  );
  const activeFlowForSecurity = resolveActiveFlow(workspaceRoot).flow;
  const securityOperation = activeFlowForSecurity?.operations.security_review;
  if (!activeFlowForSecurity || !securityOperation) {
    return rejected(
      workspaceRoot,
      before,
      "OPERATION_NOT_CONFIGURED",
      "O flow vigente não declara a operação security_review.",
      input,
      subject,
    );
  }
  if (
    !securityOperation.allowedInStages.includes("*") &&
    !securityOperation.allowedInStages.includes(item.stage)
  ) {
    return rejected(
      workspaceRoot,
      before,
      "SECURITY_STAGE_REQUIRED",
      `A operação security_review não é permitida no estágio "${item.stage}".`,
      input,
      subject,
    );
  }
  // AC4: the review needs a claim with this exact capability; say which.
  const securityClaim: RefusalGuidance | undefined =
    securityOperation.requiredCapability
      ? {
          nextCommand: claimCommand(
            item.id,
            resolvedSecurityActor,
            securityOperation.requiredCapability,
            input,
            before.revision,
          ),
        }
      : undefined;
  if (
    securityOperation.requiredCapability &&
    item.claimCapability !== securityOperation.requiredCapability
  ) {
    return rejected(
      workspaceRoot,
      before,
      "CAPABILITY_INVALID",
      `A operação security_review exige um claim com a capability "${securityOperation.requiredCapability}" (claim atual: ${item.claimCapability ?? "nenhum"}).`,
      input,
      subject,
      securityClaim,
    );
  }
  if (
    securityOperation.requiresClaim !== false &&
    (item.claimedBy !== resolvedSecurityActor ||
      item.claimExecutorId !== input.executorId)
  )
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_REQUIRED",
      `Actor e executor precisam possuir o claim vigente para executar security_review (claim atual: ${item.claimedBy ?? "nenhum"}/${item.claimExecutorId ?? "nenhum"}).`,
      input,
      subject,
      securityClaim,
    );
  const report = runScopedSecurityReview(
    securityExecutionRoot(workspaceRoot, workflow),
    item,
    securityPolicyFor(workspaceRoot),
  );
  item.securityReview = report;
  workflow.updatedAt = new Date().toISOString();
  const reportPath = securityReportPath(workspaceRoot, item.id);
  mkdirSync(join(getLetraDir(workspaceRoot), "reports", "security"), {
    recursive: true,
  });
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
    try {
      unlinkSync(reportTmp);
    } catch {
      /* keep the canonical workspace usable after a failed CAS */
    }
    return rejected(
      workspaceRoot,
      before,
      "SECURITY_REVIEW_WRITE_FAILED",
      writeResult.error ?? "Falha ao persistir a revisão de Security.",
      input,
      subject,
    );
  }
  // Rename only after the workflow write succeeds, avoiding a report that
  // claims a review which was not recorded in the canonical item state.
  renameSync(reportTmp, reportPath);
  const after = directionForOperation(workspaceRoot, input);
  const entry = audit(workspaceRoot, "agent_execution_event", before, {
    outcome:
      report.blockingFindings.length > 0 || report.decision === "needs-review"
        ? "rejected"
        : "accepted",
    reasonCode: report.reasonCode,
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
    details: { executorId: input.executorId, securityReview: report },
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(
      before,
      entry.id,
      report.blockingFindings.length > 0 || report.decision === "needs-review"
        ? "rejected"
        : "accepted",
      report.reasonCode,
      input.reason,
      after,
      { securityReview: report },
    ),
  );
}

export function completeAcOperation(
  root: string,
  input: CompleteAcInput,
): OperationResult {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    acId: input.acId,
    operation: "complete_ac",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const boundary = createWorkspaceBoundary(
    resolveWorkspaceRoot(root).workspaceDir,
  );
  const before = directionForRunAwareOperation(workspaceRoot, input);
  const subject = {
    itemId: input.itemId,
    acId: input.acId,
    operation: "complete_ac",
  };
  if (!input.itemId?.trim()) {
    return rejected(
      workspaceRoot,
      before,
      "ITEM_TARGET_REQUIRED",
      "Conclusão de AC exige itemId explícito.",
      input,
      subject,
    );
  }
  if (!before.item || before.item.id !== input.itemId) {
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      `Item alvo não encontrado: ${input.itemId}.`,
      input,
      subject,
    );
  }
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim()) {
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Conclusão de AC exige identidade do actor.",
      input,
      subject,
    );
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
  const currentItem = currentWorkflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  const executorId =
    input.executorId?.trim() || currentItem?.claimExecutorId || "unknown";
  const claimExpiresAt = currentItem?.claimExpiresAt
    ? Date.parse(currentItem.claimExpiresAt)
    : Number.NaN;
  const resolvedActor = currentItem
    ? resolveMcpActor(workspaceRoot, input.actor, currentItem.stage, executorId)
    : input.actor;
  if (
    !currentItem ||
    currentItem.claimedBy !== resolvedActor ||
    currentItem.claimExecutorId !== executorId
  ) {
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_REQUIRED",
      "Conclusão de AC exige claim vigente do actor e executor.",
      input,
      subject,
    );
  }
  if (!Number.isFinite(claimExpiresAt) || Date.now() >= claimExpiresAt) {
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_EXPIRED",
      "O lease do claim expirou; faça heartbeat ou novo claim.",
      input,
      subject,
    );
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
  const updatedSpec = markPendingAc(
    readFileSync(specPath, "utf-8"),
    requestedAc,
  );
  const acceptancePath = boundary.assertPath(join(specDir, "acceptance.md"));
  const updatedAcceptance = existsSync(acceptancePath)
    ? markPendingAc(readFileSync(acceptancePath, "utf-8"), requestedAc)
    : null;
  if (!updatedSpec && !updatedAcceptance) {
    return rejected(
      workspaceRoot,
      before,
      "AC_NOT_PENDING",
      "O AC solicitado não está pendente na spec vigente.",
      input,
      subject,
    );
  }
  if (updatedSpec) {
    const specTmp = `${specPath}.tmp`;
    writeFileSync(specTmp, updatedSpec, "utf-8");
    renameSync(specTmp, specPath);
  }
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
  const after = directionForRunAwareOperation(workspaceRoot, input);
  const entry = audit(workspaceRoot, "agent_ac_completion_requested", before, {
    outcome: "accepted",
    reasonCode: "AC_COMPLETED",
    reason: input.reason,
    actor: input.actor,
    itemId: before.item?.id,
    acId: requestedAc,
    details: { spec, evidence, executorId, afterRevision: after.revision },
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(before, entry.id, "accepted", "AC_COMPLETED", input.reason, after),
  );
}

export async function requestTransitionOperation(
  root: string,
  input: RequestTransitionInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "request_transition",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "request_transition" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim()) {
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Transição exige identidade do actor.",
      input,
      subject,
    );
  }
  if (input.force) {
    const forceCheck = requireLocalHumanStrict(
      workspaceRoot,
      input.actor,
      "workflow.transition.force",
    );
    if (forceCheck)
      return rejected(
        workspaceRoot,
        before,
        "ADMINISTRATIVE_OVERRIDE_REQUIRED",
        `Transição forçada exige actor humano verificável. ${forceCheck}`,
        input,
        subject,
      );
    if (!input.reason?.trim())
      return rejected(
        workspaceRoot,
        before,
        "ADMINISTRATIVE_OVERRIDE_REQUIRED",
        "Transição forçada exige motivo explícito.",
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
  const activeFlowForRework = resolveActiveFlow(workspaceRoot, {
    itemId: before.item.id,
    workflowVersionId: before.item.workflowVersionId,
  }).flow;
  const sourceStageDefForRework = activeFlowForRework?.stages.find(
    (s) => s.id === before.item?.stage,
  );
  if (sourceStageDefForRework?.rework?.target === input.targetStageId) {
    const resolvedActorForRework = resolveMcpActor(
      workspaceRoot,
      input.actor.trim(),
      before.item?.stage ?? "",
    );
    const isAllowedForRework =
      !sourceStageDefForRework.rework.allowed_actors?.length ||
      sourceStageDefForRework.rework.allowed_actors.includes(
        resolvedActorForRework,
      );
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
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_NOT_ALLOWED",
      `O actor "${resolvedActorForRework}" não está autorizado para o retrabalho declarado no estágio "${sourceStageDefForRework.id}".`,
      input,
      subject,
    );
  }

  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  const resolvedActor = resolveMcpActor(
    workspaceRoot,
    (input.actor ?? "").trim(),
    item?.stage ?? "",
  );
  const activeFlow = item
    ? resolveActiveFlow(workspaceRoot, {
        itemId: item.id,
        workflowVersionId: item.workflowVersionId,
      }).flow
    : null;
  const sourceDefinition = activeFlow?.stages.find(
    (stage) => stage.id === item?.stage,
  );
  let target = activeFlow?.stages.find(
    (stage) => stage.id === input.targetStageId,
  );
  if (!workflow || !item || !sourceDefinition || !target) {
    return rejected(
      workspaceRoot,
      before,
      "INVALID_TRANSITION",
      "O item ou estágio de destino não existe no workflow vigente.",
      input,
      subject,
    );
  }
  const configuredTargets =
    sourceDefinition.transitions?.map((transition) => transition.target) ?? [];
  const configuredEdge = configuredTargets.includes(target.id);
  if (!configuredEdge) {
    return rejected(
      workspaceRoot,
      before,
      "TRANSITION_NOT_CONFIGURED",
      `O workflow vinculado não configura uma aresta de "${item.stage}" para "${target.id}".`,
      input,
      subject,
    );
  }
  const repetitionVersionId = item.workflowVersionId ?? activeFlow!.workflowVersionId ?? "unversioned";
  const repetition = evaluateTransitionRepetition({
    stages: activeFlow!.stages,
    workflowVersionId: repetitionVersionId,
    from: sourceDefinition.id,
    to: target.id,
    item: item as unknown as Record<string, unknown>,
  });
  if (repetition.outcome === "reject")
    return rejected(workspaceRoot, before, repetition.reasonCode, repetition.reason, input, subject);
  if (repetition.outcome === "wait-human")
    return rejected(workspaceRoot, before, "REPETITION_TIMEOUT_USE_PASSAGE", "A política de timeout exige a passagem canônica para registrar a Run aguardando decisão humana.", input, subject);
  let repetitionState = repetition.state;
  if (repetition.outcome === "redirect") {
    const redirectedTarget = activeFlow!.stages.find((stage) => stage.id === repetition.target);
    if (!redirectedTarget || !sourceDefinition.transitions?.some((edge) => edge.target === redirectedTarget.id))
      return rejected(workspaceRoot, before, "TRANSITION_TIMEOUT_TARGET_NOT_CONFIGURED", "O destino de timeout não é uma aresta declarada do estágio atual.", input, subject);
    const redirected = evaluateTransitionRepetition({
      stages: activeFlow!.stages,
      workflowVersionId: repetitionVersionId,
      from: sourceDefinition.id,
      to: redirectedTarget.id,
      item: { ...item, repetitionState } as unknown as Record<string, unknown>,
    });
    if (redirected.outcome !== "allow")
      return rejected(workspaceRoot, before, "TRANSITION_TIMEOUT_TARGET_POLICY_UNSUPPORTED", "O destino de timeout possui uma política de repetição que não pode ser resolvida como uma única passagem.", input, subject);
    target = redirectedTarget;
    repetitionState = redirected.state;
  }
  const ownsClaim = item?.claimedBy === input.actor;

  const targetDefinition = activeFlow?.stages.find(
    (stage) => stage.id === target.id,
  );

  // Check for valid handoff to target stage
  const hasValidHandoff =
    item?.handoff &&
    item.handoff.expiresAt &&
    Date.now() < Date.parse(item.handoff.expiresAt) &&
    (targetDefinition?.agents ?? []).includes(item.handoff.to);

  if (
    !input.actor.startsWith("human:") &&
    before.allowedStageIds.length > 0 &&
    !before.allowedStageIds.includes(target.id) &&
    !(ownsClaim && configuredEdge) &&
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
  const blockingGate = sourceDefinition?.gate?.blocking
    ? sourceDefinition.gate
    : null;
  if (blockingGate) {
    const checker = new GateChecker(workspaceRoot);
    const gateResult = checker.check(blockingGate.id, item);
    if (blockingGate.type === "human") {
      const gateHint = targetDefinition?.activity?.gate;
      const reviewHint = targetDefinition?.activity?.review;
      const enriched: AgentDirectionSnapshot = {
        ...before,
        allowedStageIds: targetDefinition
          ? [
              ...new Set(
                targetDefinition.roles.flatMap((role) => role.allowedStages),
              ),
            ]
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

  // A blocking human gate is the explicit approval boundary for leaving a
  // stage (for example, approving a spec before implementation ACs can be
  // completed). Surface that decision before checking implementation ACs;
  // the authenticated gate decision performs the transition and keeps those
  // ACs pending for the destination stage.
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
  // Ordinary stage changes must carry destination identity, executor,
  // evidence and summary in one atomic passage operation. The only direct
  // transition retained is the separately authenticated administrative force.
  if (!input.force)
    return rejected(
      workspaceRoot,
      before,
      "CANONICAL_PASSAGE_REQUIRED",
      "Mudanças de estágio do workflow exigem a operação canônica de passagem, com destino, executor, resumo e evidências. Use request_passage; gates humanos e rework usam suas operações próprias.",
      input,
      subject,
    );

  item.repetitionState = repetitionState;
  const from = item.stage;
  // YAML-driven hooks: read on_enter hooks from flow definition instead of hardcoded stage names.
  const activeFlowForHooks = resolveActiveFlow(workspaceRoot).flow;
  const targetStageDefForHooks = activeFlowForHooks?.stages.find(
    (s) => s.id === target.id,
  );
  const onEnterHooks = targetStageDefForHooks?.hooks?.on_enter ?? [];
  for (const hook of onEnterHooks) {
    if (!hook.auto) continue;
    if (hook.requiresClaim && !ownsClaim) continue;
    if (hook.action === "capture_baseline" && !isUsableBaseline(item.securityBaseline)) {
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
  if (item.spec)
    writeFocusWithRecommendations(workspaceRoot, item.spec, item.id);

  const after = directionForOperation(workspaceRoot, input);
  const entry = audit(workspaceRoot, "agent_transition_requested", before, {
    outcome: "accepted",
    reasonCode: "TRANSITION_COMPLETED",
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
    details: {
      from,
      to: target!.id,
      afterRevision: after.revision,
      administrativeOverride: input.force === true,
      pendingAcBypassed: input.force ? (before.pendingAC?.id ?? null) : null,
    },
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(
      before,
      entry.id,
      "accepted",
      "TRANSITION_COMPLETED",
      input.reason,
      after,
    ),
  );
}

/** Atomically changes stage, hands the item to the next actor, releases the old claim and advances its active Run. */
export function requestPassageOperation(
  root: string,
  input: RequestPassageInput,
): OperationResult {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "request_passage",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const subject = { itemId: input.itemId, operation: "request_passage" };
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForRunAwareOperation(workspaceRoot, input);
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Passagem exige identidade do actor.",
      input,
      subject,
    );

  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  const resolvedActor = resolveMcpActor(
    workspaceRoot,
    (input.actor ?? "").trim(),
    item?.stage ?? "",
    input.executorId,
  );
  const activeFlow = item
    ? resolveActiveFlow(workspaceRoot, {
        itemId: item.id,
        workflowVersionId: item.workflowVersionId,
      }).flow
    : null;
  const source = activeFlow?.stages.find((stage) => stage.id === item?.stage);
  if (!workflow || !item || !activeFlow || !source)
    return rejected(
      workspaceRoot,
      before,
      "INVALID_TRANSITION",
      "O item ou estágio configurado não existe no workflow vinculado.",
      input,
      subject,
    );
  let humanRecipient = input.to === "human" || input.to.startsWith("human:");
  let effectiveTo = input.to;
  const destinationCandidates = activeFlow.stages.filter(
    (stage) =>
      (stage.agents ?? []).includes(input.to) &&
      (stage.id === source.id ||
        (source.transitions ?? []).some((edge) => edge.target === stage.id)),
  );
  let targetStageId =
    input.targetStageId ??
    (destinationCandidates.length === 1
      ? destinationCandidates[0].id
      : humanRecipient
        ? source.id
        : undefined);
  if (!targetStageId && destinationCandidates.length > 1)
    return rejected(
      workspaceRoot,
      before,
      "PASSAGE_TARGET_AMBIGUOUS",
      `O destino "${input.to}" corresponde a mais de um estágio de saída configurado (${destinationCandidates.map((stage) => stage.id).join(", ")}).`,
      input,
      subject,
    );
  if (!targetStageId)
    return rejected(
      workspaceRoot,
      before,
      "PASSAGE_TARGET_UNRESOLVED",
      `O destino "${input.to}" não corresponde a um estágio de saída configurado.`,
      input,
      subject,
    );
  let target = activeFlow.stages.find((stage) => stage.id === targetStageId);
  if (!target)
    return rejected(
      workspaceRoot,
      before,
      "INVALID_TRANSITION",
      "O estágio de destino não existe no workflow vinculado.",
      input,
      subject,
    );
  const requestedTarget = target;
  let sameStageHandoff = source.id === requestedTarget.id;
  let passageEdge = (source.transitions ?? []).find((edge) => edge.target === requestedTarget.id);
  let timeoutWaitHuman = false;
  let repetitionState = (item.repetitionState && typeof item.repetitionState === "object" && !Array.isArray(item.repetitionState) ? item.repetitionState : {}) as Record<string, unknown>;
  if (!sameStageHandoff && passageEdge) {
    const repetitionVersionId = item.workflowVersionId ?? activeFlow.workflowVersionId ?? "unversioned";
    const repetition = evaluateTransitionRepetition({
      stages: activeFlow.stages,
      workflowVersionId: repetitionVersionId,
      from: source.id,
      to: requestedTarget.id,
      item: item as unknown as Record<string, unknown>,
    });
    if (repetition.outcome === "reject") return rejected(workspaceRoot, before, repetition.reasonCode, repetition.reason, input, subject);
    repetitionState = repetition.state;
    if (repetition.outcome === "wait-human") {
      timeoutWaitHuman = true;
      humanRecipient = true;
      effectiveTo = "human";
      target = source;
      targetStageId = source.id;
      sameStageHandoff = true;
    } else if (repetition.outcome === "redirect") {
      const redirectedTarget = activeFlow.stages.find((stage) => stage.id === repetition.target);
      if (!redirectedTarget || !(source.transitions ?? []).some((edge) => edge.target === redirectedTarget.id))
        return rejected(workspaceRoot, before, "TRANSITION_TIMEOUT_TARGET_NOT_CONFIGURED", "O destino de timeout não é uma aresta declarada do estágio atual.", input, subject);
      const redirected = evaluateTransitionRepetition({
        stages: activeFlow.stages,
        workflowVersionId: repetitionVersionId,
        from: source.id,
        to: redirectedTarget.id,
        item: { ...item, repetitionState } as unknown as Record<string, unknown>,
      });
      if (redirected.outcome !== "allow")
        return rejected(workspaceRoot, before, "TRANSITION_TIMEOUT_TARGET_POLICY_UNSUPPORTED", "O destino de timeout possui uma política de repetição que não pode ser resolvida como uma única passagem.", input, subject);
      target = redirectedTarget;
      targetStageId = redirectedTarget.id;
      passageEdge = (source.transitions ?? []).find((edge) => edge.target === redirectedTarget.id);
      repetitionState = redirected.state;
      sameStageHandoff = false;
    }
  }
  if (!sameStageHandoff && before.pendingAC && passageEdge?.allowPendingAcceptanceCriteria !== true)
    return rejected(workspaceRoot, before, "PENDING_ACCEPTANCE_CRITERIA", `O item ainda possui o critério pendente ${before.pendingAC.id}; esta aresta não permite passagem com AC pendente.`, input, subject);
  const blockingHumanGate = Boolean(
    source.gate?.blocking && source.gate.type === "human",
  );
  if (
    !sameStageHandoff &&
    !(source.transitions ?? []).some((edge) => edge.target === target.id)
  )
    return rejected(
      workspaceRoot,
      before,
      "TRANSITION_NOT_CONFIGURED",
      `O workflow não configura a passagem de "${source.id}" para "${target.id}".`,
      input,
      subject,
    );
  const passageOperation = activeFlow?.operations.handoff;
  if (
    passageOperation &&
    !passageOperation.allowedInStages.includes("*") &&
    !passageOperation.allowedInStages.includes(source.id)
  )
    return rejected(
      workspaceRoot,
      before,
      "HANDOFF_STAGE_NOT_ALLOWED",
      `A operação de passagem não é permitida no estágio de origem "${source.id}".`,
      input,
      subject,
    );
  if (
    passageOperation?.allowedActors.length &&
    !passageOperation.allowedActors.includes(input.actor.trim())
  )
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_NOT_ALLOWED",
      `O solicitante "${input.actor.trim()}" não está autorizado a solicitar passagem.`,
      input,
      subject,
    );
  const claimHolder = item.claimedBy;
  if (!claimHolder || !item.claimExecutorId || item.claimExecutorId !== input.executorId)
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_REQUIRED",
      "A passagem exige claim vigente do executor de origem.",
      input,
      subject,
    );
  if (
    !item.claimExpiresAt ||
    !Number.isFinite(Date.parse(item.claimExpiresAt)) ||
    Date.now() >= Date.parse(item.claimExpiresAt)
  )
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_EXPIRED",
      "O claim expirou antes da passagem.",
      input,
      subject,
    );
  const sourceRole = source.roles.find((role) => role.id === claimHolder);
  if (
    sourceRole?.capabilities.length &&
    (!item.claimCapability ||
      !sourceRole.capabilities.includes(item.claimCapability))
  )
    return rejected(
      workspaceRoot,
      before,
      "CAPABILITY_INVALID",
      `A capability do claim de origem não está autorizada para o papel "${claimHolder}".`,
      input,
      subject,
    );
  if (
    passageOperation?.requiredCapability &&
    item.claimCapability !== passageOperation.requiredCapability
  )
    return rejected(
      workspaceRoot,
      before,
      "CAPABILITY_INVALID",
      `A operação de passagem exige a capability "${passageOperation.requiredCapability}".`,
      input,
      subject,
    );
  if (passageOperation?.requiresClaim === true && !item.claimCapability)
    return rejected(
      workspaceRoot,
      before,
      "CAPABILITY_INVALID",
      "A operação de passagem exige um claim com capability autorizada.",
      input,
      subject,
    );
  if (!humanRecipient && !(target.agents ?? []).includes(effectiveTo))
    return rejected(
      workspaceRoot,
      before,
      "DESTINATION_ACTOR_NOT_ALLOWED",
      `O actor "${effectiveTo}" não está atribuído ao estágio "${target.id}".`,
      input,
      subject,
    );
  if (humanRecipient && !blockingHumanGate && !timeoutWaitHuman)
    return rejected(
      workspaceRoot,
      before,
      "HUMAN_HANDOFF_REQUIRES_BLOCKING_GATE",
      "Handoff para uma pessoa exige gate humano bloqueante configurado no estágio.",
      input,
      subject,
    );
  const destinationRole = target.roles.find((role) => role.id === effectiveTo);
  if (
    destinationRole?.allowedStages.length &&
    !destinationRole.allowedStages.includes(target.id)
  )
    return rejected(
      workspaceRoot,
      before,
      "DESTINATION_ACTOR_NOT_ALLOWED",
      `O papel "${effectiveTo}" não está habilitado para executar o estágio de destino "${target.id}".`,
      input,
      subject,
    );
  if (
    item.handoff &&
    Number.isFinite(Date.parse(item.handoff.expiresAt)) &&
    Date.parse(item.handoff.expiresAt) > Date.now() &&
    item.handoff.executorId !== input.executorId &&
    item.handoff.to !== resolvedActor
  )
    return rejected(
      workspaceRoot,
      before,
      "HANDOFF_CONFLICT",
      "Já existe um handoff ativo para outro executor.",
      input,
      subject,
    );
  if (!input.summary?.trim())
    return rejected(
      workspaceRoot,
      before,
      "HANDOFF_SUMMARY_REQUIRED",
      "A passagem exige um resumo do handoff.",
      input,
      subject,
    );
  const structuredEvidence: HandoffEvidence[] = [];
  const boundary = createWorkspaceBoundary(
    resolveWorkspaceRoot(root).workspaceDir,
  );
  for (const evidence of input.evidence ?? []) {
    const value =
      typeof evidence === "string" ? evidence.trim() : evidence.value?.trim();
    const kind =
      typeof evidence === "string" ? evidenceKind(value) : evidence.kind;
    const evidenceSource =
      typeof evidence === "string" ? "passage" : evidence.source?.trim();
    if (!value || !evidenceSource)
      return rejected(
        workspaceRoot,
        before,
        "EVIDENCE_INVALID",
        "Cada evidência precisa de valor e origem.",
        input,
        subject,
      );
    if (kind === "file" || kind === "diff" || kind === "artifact") {
      try {
        const path = boundary.assertPath(value);
        if (existsSync(path) && statSync(path).isSymbolicLink())
          throw new Error("symlink");
      } catch {
        return rejected(
          workspaceRoot,
          before,
          "EVIDENCE_PATH_OUTSIDE_WORKSPACE",
          "Path da evidência fora do workspace autorizado.",
          input,
          subject,
        );
      }
    }
    structuredEvidence.push(
      typeof evidence === "string"
        ? {
            kind,
            value,
            source: evidenceSource,
            observedAt: new Date().toISOString(),
            sha256: createHash("sha256").update(value).digest("hex"),
          }
        : {
            ...evidence,
            kind,
            value,
            source: evidenceSource,
            observedAt: evidence.observedAt ?? new Date().toISOString(),
            sha256:
              evidence.sha256 ??
              createHash("sha256").update(value).digest("hex"),
          },
    );
  }
  if (source.gate?.blocking && !humanRecipient) {
    const gate = new GateChecker(workspaceRoot).checkHandoffAllowed(
      source.gate.id,
      item,
    );
    if (!gate.allowed)
      return rejected(
        workspaceRoot,
        before,
        gate.reasonCode ?? "BLOCKING_GATE",
        gate.reason ?? `O gate "${source.gate.name}" bloqueia a passagem.`,
        input,
        subject,
      );
  }
  const activeRuns = readExecutionRuns(workspaceRoot).runs.filter(
    (run) => run.itemId === item.id && isRunActiveForDirection(run),
  );
  if (activeRuns.length > 1)
    return rejected(
      workspaceRoot,
      before,
      "RUN_SELECTION_REQUIRED",
      "Mais de uma Run ativa corresponde ao item; selecione uma Run antes da passagem.",
      input,
      subject,
    );
  const activeRun = activeRuns[0];
  if (timeoutWaitHuman && !activeRun)
    return rejected(
      workspaceRoot,
      before,
      "RUN_REQUIRED_FOR_TIMEOUT_WAIT_HUMAN",
      "A política wait-human exige uma Run ativa para persistir a espera humana.",
      input,
      subject,
    );
  if (
    activeRun &&
    (activeRun.binding.roleId !== claimHolder ||
      activeRun.binding.executorId !== item.claimExecutorId ||
      activeRun.workflowStageId !== source.id ||
      activeRun.workflowVersionId !== item.workflowVersionId)
  )
    return rejected(
      workspaceRoot,
      before,
      "RUN_BINDING_MISMATCH",
      "A Run ativa não corresponde ao actor, executor, estágio e versão vinculados ao claim de origem.",
      input,
      subject,
    );
  const now = new Date();
  const transactionId = `passage-${randomUUID()}`;
  const nextWorkflow = structuredClone(workflow);
  const nextItem = nextWorkflow.items.find(
    (candidate) => candidate.id === item.id,
  )!;
  const expiry = new Date(
    now.getTime() + (input.ttlMinutes ?? 30) * 60_000,
  ).toISOString();
  if (nextItem.handoff) {
    const priorExpiry = Date.parse(nextItem.handoff.expiresAt);
    const priorStatus =
      nextItem.handoff.status ??
      (Number.isFinite(priorExpiry) && priorExpiry <= now.getTime()
        ? "expired"
        : "superseded");
    nextItem.handoffHistory = [
      ...(nextItem.handoffHistory ?? []),
      { ...nextItem.handoff, status: priorStatus },
    ];
  }
  nextItem.stage = target.id;
  nextItem.repetitionState = repetitionState as NonNullable<Item["repetitionState"]>;
  nextItem.handoff = {
    from: claimHolder,
    to: effectiveTo,
    summary: timeoutWaitHuman ? `${input.summary.trim()} (timeout policy: waiting for human)` : input.summary.trim(),
    evidence: structuredEvidence.map((entry) => entry.value),
    timestamp: now.toISOString(),
    expiresAt: expiry,
    executorId: input.executorId,
  };
  delete nextItem.claimedBy;
  delete nextItem.claimedAt;
  delete nextItem.claimExecutorId;
  delete nextItem.claimCapability;
  delete nextItem.claimRevision;
  delete nextItem.claimExpiresAt;
  delete nextItem.claimTtlMinutes;
  nextWorkflow.updatedAt = now.toISOString();
  const nextRun: RunEntity | undefined = activeRun
    ? {
        ...activeRun,
        binding: activeRun.binding,
        workflowStageId: target.id,
        authorization: {
          ...activeRun.authorization,
          kind: "handoff",
          actorId: effectiveTo,
          referenceId: transactionId,
          grantedAt: now.toISOString(),
          revision: before.revision,
        },
        handoffs: [
          ...activeRun.handoffs,
          {
            itemId: item.id,
            fromActorId: claimHolder,
            toActorId: effectiveTo,
            evidenceIds: structuredEvidence.map(
              (entry) => entry.sha256 ?? entry.value,
            ),
            createdAt: now.toISOString(),
            expiresAt: expiry,
            fromStageId: source.id,
            toStageId: target.id,
            transitionId: `${source.id}->${target.id}`,
            summary: timeoutWaitHuman ? `${input.summary.trim()} (timeout policy: waiting for human)` : input.summary.trim(),
            reason: input.reason,
          },
        ],
        cycle: { ...activeRun.cycle, endedAt: now.toISOString() },
        lease: null,
        revision: activeRun.revision + 1,
        updatedAt: now.toISOString(),
        status: humanRecipient ? "waiting-human" : "queued",
      }
    : undefined;
  const specContent = item.spec
    ? (() => {
        try {
          return readFileSync(
            join(getLetraDir(workspaceRoot), "specs", item.spec, "spec.md"),
            "utf8",
          );
        } catch {
          return null;
        }
      })()
    : null;
  const baseAfter = createAgentDirectionSnapshot({
    workspaceRoot,
    workflow: nextWorkflow,
    flow: activeFlow,
    specContent,
    currentItemId: item.id,
  });
  let after = baseAfter;
  if (nextRun) {
    const semantic = {
      schemaVersion: baseAfter.schemaVersion,
      source: baseAfter.source,
      mode: baseAfter.mode,
      run: {
        id: nextRun.id,
        itemId: nextRun.itemId,
        executorId: nextRun.binding.executorId,
        workflowVersionId: nextRun.workflowVersionId,
        status: nextRun.status,
      },
      item: baseAfter.item,
      roleIds: baseAfter.roleIds,
      allowedStageIds: baseAfter.allowedStageIds,
      objective: baseAfter.objective,
      pendingAC: baseAfter.pendingAC,
      commands: baseAfter.commands,
      operations: baseAfter.operations,
      gates: baseAfter.gates,
      references: baseAfter.references,
      prohibitions: baseAfter.prohibitions,
      requiredEvidence: baseAfter.requiredEvidence,
      nextActions: baseAfter.nextActions,
      warnings: baseAfter.warnings,
      governanceReferences: baseAfter.governanceReferences,
      constitutionVersion: baseAfter.constitutionVersion,
    };
    after = {
      ...baseAfter,
      run: semantic.run,
      revision: `sha256:${createHash("sha256").update(JSON.stringify(semantic)).digest("hex")}`,
    };
    // ITEM-39: an active Run is seen through its assigned direction (what the
    // next operation compares); a predicted bare Run revision never matched it.
    if (isRunActiveForDirection(nextRun)) after = withRunAssignment(after, nextRun.id);
  }
  const reasonCode = timeoutWaitHuman
    ? "REPETITION_TIMEOUT_WAITING_HUMAN"
    : humanRecipient
      ? "HUMAN_GATE_WAITING"
      : "PASSAGE_COMPLETED";
  const entry = createLogEntry("agent_execution_event", input.reason, {
    itemId: item.id,
    details: {
      adapter: auditAdapter(input.actor),
      by: input.actor,
      revision: before.revision,
      outcome: "accepted",
      reasonCode,
      from: item.stage,
      to: target.id,
      handoffTo: effectiveTo,
      executorId: input.executorId,
      runId: nextRun?.id,
      transactionId,
    },
  });
  const output = result(
    before,
    entry.id,
    "accepted",
    reasonCode,
    input.reason,
    after,
  );
  const dataRoot = getLetraDir(workspaceRoot);
  const workflowPath = join(dataRoot, "workflow.json");
  const runsPath = join(dataRoot, "runtime", "runs.json");
  const idempotencyFile = idempotencyPath(workspaceRoot);
  const workflowRaw = readFileSync(workflowPath, "utf8");
  const runsRaw = existsSync(runsPath) ? readFileSync(runsPath, "utf8") : null;
  const idempotencyRaw = existsSync(idempotencyFile)
    ? readFileSync(idempotencyFile, "utf8")
    : null;
  let idempotencyWrites: {
    path: string;
    expectedHash: string | null;
    contents: string;
  }[] = [];
  if (input.idempotencyKey?.trim()) {
    let records: Record<string, unknown> = {};
    try {
      records = JSON.parse(idempotencyRaw ?? "{}") as Record<string, unknown>;
    } catch {
      return rejected(
        workspaceRoot,
        before,
        "IDEMPOTENCY_STORE_INVALID",
        "O arquivo de idempotência não é JSON válido.",
        input,
        subject,
      );
    }
    records[input.idempotencyKey] = {
      fingerprint: inputFingerprint(input),
      result: output,
    };
    idempotencyWrites = [
      {
        path: idempotencyFile,
        expectedHash:
          idempotencyRaw === null
            ? null
            : createHash("sha256").update(idempotencyRaw).digest("hex"),
        contents: JSON.stringify(records, null, 2) + "\n",
      },
    ];
  }
  const runsStore =
    runsRaw === null
      ? { schemaVersion: 1, runs: [] as RunEntity[] }
      : (JSON.parse(runsRaw) as { schemaVersion: number; runs: RunEntity[] });
  if (nextRun)
    runsStore.runs = runsStore.runs.map((run) =>
      run.id === nextRun.id ? nextRun : run,
    );
  const sha = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  try {
    commitWorkspaceTransaction(workspaceRoot, {
      transactionId,
      writes: [
        {
          path: workflowPath,
          expectedHash: sha(workflowRaw),
          contents: JSON.stringify(nextWorkflow, null, 2),
        },
        ...(nextRun
          ? [
              {
                path: runsPath,
                expectedHash: runsRaw === null ? null : sha(runsRaw),
                contents: JSON.stringify(runsStore, null, 2) + "\n",
              },
            ]
          : []),
        ...idempotencyWrites,
      ],
      appends: [
        {
          path: jsonlPathForDate(workspaceRoot, new Date(entry.timestamp)),
          dedupeToken: transactionId,
          line: JSON.stringify(entry),
        },
      ],
      validate: () => {
        const current = directionForRunAwareOperation(workspaceRoot, input);
        if (current.revision !== before.revision)
          throw new Error("DIRECTION_STALE");
        if (activeRun) {
          const currentRun = readExecutionRuns(workspaceRoot).runs.find(
            (run) => run.id === activeRun.id,
          );
          if (!currentRun || currentRun.revision !== activeRun.revision)
            throw new Error("RUN_REVISION_CONFLICT");
        }
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The commit marker is the linearization point. If projection failed after it,
    // recover and replay the durable result; never report a committed passage as rejected.
    try {
      recoverWorkspaceTransaction(workspaceRoot);
    } catch {
      /* retain the durable outcome below */
    }
    if (isWorkspaceTransactionCommitted(workspaceRoot, transactionId))
      return output;
    const replayAfterRecovery = replayIdempotent(workspaceRoot, input);
    if (replayAfterRecovery) return replayAfterRecovery;
    const code = message.startsWith("DIRECTION_STALE")
      ? "DIRECTION_STALE"
      : message.startsWith("RUN_REVISION_CONFLICT") ||
          message.startsWith("WORKSPACE_TRANSACTION_CAS_CONFLICT")
        ? "CAS_CONFLICT"
        : "PASSAGE_COMMIT_FAILED";
    return result(before, "not-committed", "rejected", code, message);
  }
  return output;
}

export async function activateWorkOperation(
  root: string,
  input: ActivateWorkInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "activate_work",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "activate_work" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  const humanCheck = requireLocalHumanStrict(
    workspaceRoot,
    input.actor,
    "workflow.activate",
  );
  if (humanCheck)
    return rejected(
      workspaceRoot,
      before,
      "HUMAN_ACTOR_REQUIRED",
      humanCheck,
      input,
      subject,
    );
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Ativação exige identidade do actor.",
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const flow = resolveActiveFlow(workspaceRoot).flow;
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  // AC1: every cause gets its own code; the fix is a human's (activation is
  // human-only), so the suggested command is a diagnosis the agent may run.
  const diagnose: RefusalGuidance = {
    nextCommand: "letra doctor",
    humanRequired: true,
  };
  if (!workflow)
    return rejected(
      workspaceRoot,
      before,
      "FLOW_NOT_LOADED",
      "O workspace não possui workflow carregável; nada pode ser ativado.",
      input,
      subject,
      diagnose,
    );
  if (!item)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      `O item ${input.itemId} não existe no workspace.`,
      input,
      subject,
      { nextCommand: "letra flow backlog list", humanRequired: true },
    );
  const initial = flow?.stages
    .filter((stage) => stage.roleIds.length > 0 && stage.id !== item.stage)
    .sort((left, right) => left.order - right.order)[0];
  const flowWarning = flow?.warnings.find(
    (warning) =>
      warning.code === "HARNESS_UNAVAILABLE" ||
      warning.code === "TEMPLATE_NOT_FOUND",
  );
  // A fallback flow built because the harness or template did not load has no
  // roles, which used to surface as "only Backlog items can be activated".
  if (!flow || (!initial && flow.source === "legacy-fallback" && flowWarning))
    return rejected(
      workspaceRoot,
      before,
      "FLOW_NOT_LOADED",
      `O flow vigente não carregou${flowWarning ? `: ${flowWarning.message}` : "."} Sem ele não há estágio com papel para receber o item.`,
      input,
      subject,
      diagnose,
    );
  const current = flow.stages.find((stage) => stage.id === item.stage);
  if (!current)
    return rejected(
      workspaceRoot,
      before,
      "ACTIVATION_NOT_ALLOWED",
      `O estágio "${item.stage}" do item ${item.id} não existe no flow vigente.`,
      input,
      subject,
      diagnose,
    );
  if (current.roleIds.length > 0)
    return rejected(
      workspaceRoot,
      before,
      "ACTIVATION_NOT_ALLOWED",
      `O item ${item.id} já está ativo no estágio "${current.id}" (papéis: ${current.roleIds.join(", ")}); só itens no Backlog sem responsável são ativados.`,
      input,
      subject,
      { nextCommand: `letra direction --item ${item.id} --json` },
    );
  if (!initial)
    return rejected(
      workspaceRoot,
      before,
      "NO_INITIAL_STAGE",
      "Nenhum estágio do flow vigente tem papel configurado para receber o item.",
      input,
      subject,
      diagnose,
    );
  const actor = initial.roleIds[0];
  if (!actor)
    return rejected(
      workspaceRoot,
      before,
      "NO_COMPATIBLE_BINDING",
      "O estágio inicial não possui uma persona permitida.",
      input,
      subject,
    );
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
  item.claimedBy = undefined;
  item.claimedAt = undefined;
  item.claimExpiresAt = undefined;
  item.claimExecutorId = undefined;
  item.claimCapability = undefined;
  item.claimRevision = undefined;
  item.claimTtlMinutes = undefined;
  workflow.primaryItemId = item.id;
  workflow.updatedAt = now.toISOString();
  const expectedRevision = directionForOperation(workspaceRoot, input).revision;
  const writeResult = await writeWorkflow(workspaceRoot, {
    workflow,
    source: "flow-handoff",
    primaryItemId: item.id,
    skipSitrep: true,
    skipLog: true,
    quiet: true,
    confineAdapterWrites: true,
    expectedRevision,
  });
  if (!writeResult.ok)
    return rejected(
      workspaceRoot,
      before,
      "ACTIVATION_WRITE_FAILED",
      writeResult.error ?? "Falha ao persistir a ativação.",
      input,
      subject,
    );
  if (item.spec)
    writeFocusWithRecommendations(workspaceRoot, item.spec, item.id);
  const after = directionForOperation(workspaceRoot, input);
  const entry = audit(workspaceRoot, "handoff", before, {
    outcome: "accepted",
    reasonCode: "WORK_ACTIVATED",
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
    details: {
      from: current.id,
      to: initial.id,
      handoffTo: actor,
      afterRevision: after.revision,
    },
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(before, entry.id, "accepted", "WORK_ACTIVATED", input.reason, after),
  );
}

export async function releaseClaimOperation(
  root: string,
  input: ReleaseClaimInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "release_claim",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "release_claim" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Release exige identidade do actor.",
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  if (!workflow || !item)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      "Item não encontrado.",
      input,
      subject,
    );
  const resolvedReleaseActor = resolveMcpActor(
    workspaceRoot,
    (input.actor ?? "").trim(),
    item.stage,
  );
  if (item.claimedBy && item.claimedBy !== resolvedReleaseActor)
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_CONFLICT",
      "Somente o actor do claim pode liberá-lo.",
      input,
      subject,
    );
  const releasedExecutorId = item.claimExecutorId;
  item.claimedBy = undefined;
  item.claimedAt = undefined;
  item.claimExpiresAt = undefined;
  item.claimExecutorId = undefined;
  item.claimCapability = undefined;
  item.claimRevision = undefined;
  item.claimTtlMinutes = undefined;
  workflow.updatedAt = new Date().toISOString();
  const writeResult = await writeWorkflow(workspaceRoot, {
    workflow,
    source: "flow-release",
    primaryItemId: item.id,
    skipSitrep: true,
    skipLog: true,
    quiet: true,
    confineAdapterWrites: true,
    expectedRevision: before.revision,
  });
  if (!writeResult.ok)
    return rejected(
      workspaceRoot,
      before,
      "RELEASE_WRITE_FAILED",
      writeResult.error ?? "Falha ao liberar claim.",
      input,
      subject,
    );
  let after = directionForOperation(workspaceRoot, input);
  const run = releasedExecutorId
    ? readExecutionRuns(workspaceRoot).runs.find(
        (entry) =>
          entry.itemId === item.id &&
          entry.binding.executorId === releasedExecutorId &&
          entry.status === "running",
      )
    : null;
  if (run) {
    const now = new Date().toISOString();
    try {
      const updated = updateExecutionRun(
        workspaceRoot,
        run.id,
        run.revision,
        (current) => ({
          ...current,
          lease: null,
          cycle: { ...current.cycle, endedAt: now },
          revision: current.revision + 1,
          directionRevision: after.revision,
          updatedAt: now,
          status: "completed",
          result: {
            outcome: "cancelled",
            finishedAt: now,
            summary: input.reason,
            evidenceIds: current.evidence.map((evidence) => evidence.id),
          },
        }),
      );
      after = resolveOperationDirection(workspaceRoot, { runId: updated.id });
    } catch (error) {
      return rejected(
        workspaceRoot,
        before,
        "RUN_RELEASE_WRITE_FAILED",
        error instanceof Error ? error.message : "Falha ao liberar a Run.",
        input,
        subject,
      );
    }
  }
  const entry = audit(workspaceRoot, "agent_claim_requested", before, {
    outcome: "accepted",
    reasonCode: "CLAIM_RELEASED",
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(before, entry.id, "accepted", "CLAIM_RELEASED", input.reason, after),
  );
}

/** Recover every expired persisted lease after a dispatcher restart. */
export async function reclaimExpiredClaimsOperation(
  root: string,
  input: ReclaimExpiredClaimsInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    operation: "reclaim_expired_claims",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = input.itemId
    ? directionForOperation(workspaceRoot, input)
    : resolveAgentDirection(workspaceRoot);
  const subject = {
    ...(input.itemId ? { itemId: input.itemId } : {}),
    operation: "reclaim_expired_claims",
  };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.startsWith("system:"))
    return rejected(
      workspaceRoot,
      before,
      "SYSTEM_ACTOR_REQUIRED",
      "Recovery automática exige identidade system verificável.",
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  if (!workflow)
    return rejected(
      workspaceRoot,
      before,
      "WORKFLOW_NOT_FOUND",
      "Workflow não encontrado.",
      input,
      subject,
    );
  const now = Date.now();
  const reclaimed: string[] = [];
  const expiredHandoffs: string[] = [];
  for (const item of workflow.items) {
    if (input.itemId && item.id !== input.itemId) continue;
    const expiry = item.claimExpiresAt
      ? Date.parse(item.claimExpiresAt)
      : Number.NaN;
    const claimExpired = Boolean(
      item.claimedBy && Number.isFinite(expiry) && now >= expiry,
    );
    const handoffExpiry = item.handoff?.expiresAt
      ? Date.parse(item.handoff.expiresAt)
      : Number.NaN;
    const handoffExpired = Boolean(
      item.handoff && Number.isFinite(handoffExpiry) && now >= handoffExpiry,
    );
    if (!claimExpired && !handoffExpired) continue;
    if (claimExpired) {
      for (const key of [
        "claimedBy",
        "claimedAt",
        "claimExpiresAt",
        "claimExecutorId",
        "claimCapability",
        "claimRevision",
        "claimTtlMinutes",
        "activityStatus",
        "activityStartedAt",
        "lastHeartbeatAt",
      ] as const)
        item[key] = undefined;
      reclaimed.push(item.id);
    }
    if (handoffExpired && item.handoff) {
      item.handoffHistory = [
        ...(item.handoffHistory ?? []),
        { ...item.handoff, status: "expired" },
      ];
      delete item.handoff;
      expiredHandoffs.push(item.id);
    }
  }
  if (reclaimed.length === 0 && expiredHandoffs.length === 0)
    return result(
      before,
      "reclaim-none",
      "accepted",
      "NO_EXPIRED_CLAIMS",
      "Nenhum claim ou handoff expirado para recuperar.",
      before,
    );
  workflow.updatedAt = new Date().toISOString();
  const write = await writeWorkflow(workspaceRoot, {
    workflow,
    source: "orchestrator-reclaim",
    primaryItemId: input.itemId,
    skipSitrep: true,
    skipLog: true,
    quiet: true,
    expectedRevision: before.revision,
  });
  if (!write.ok)
    return rejected(
      workspaceRoot,
      before,
      write.error?.startsWith("DIRECTION_STALE")
        ? "DIRECTION_STALE"
        : "RECLAIM_WRITE_FAILED",
      write.error ?? "Falha ao recuperar claims expirados.",
      input,
      subject,
    );
  const after = input.itemId
    ? directionForOperation(workspaceRoot, input)
    : resolveAgentDirection(workspaceRoot);
  const entry = audit(workspaceRoot, "item_reclaim", before, {
    outcome: "accepted",
    reasonCode: "CLAIMS_RECLAIMED",
    reason: input.reason,
    actor: input.actor,
    itemId: input.itemId,
    details: { itemIds: reclaimed, expiredHandoffItemIds: expiredHandoffs },
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(
      before,
      entry.id,
      "accepted",
      "CLAIMS_RECLAIMED",
      input.reason,
      after,
    ),
  );
}

/** Roll back a pending handoff without recreating a second claim state. */
export async function rollbackHandoffOperation(
  root: string,
  input: RollbackHandoffInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "rollback_handoff",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "rollback_handoff" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Rollback exige identidade do actor.",
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  if (!workflow || !item)
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      "Item não encontrado.",
      input,
      subject,
    );
  if (!item.handoff)
    return rejected(
      workspaceRoot,
      before,
      "HANDOFF_NOT_FOUND",
      "O item não possui handoff pendente.",
      input,
      subject,
    );
  const previousTo = item.handoff.to;
  const previousFrom = item.handoff.from;
  const previousExecutor = item.handoff.executorId;
  item.handoffHistory = [
    ...(item.handoffHistory ?? []),
    { ...item.handoff, status: "cancelled" },
  ];
  item.handoff = undefined;
  item.claimedBy = previousFrom;
  item.claimedAt = new Date().toISOString();
  item.claimExecutorId = previousExecutor;
  workflow.updatedAt = new Date().toISOString();
  const writeResult = await writeWorkflow(workspaceRoot, {
    workflow,
    source: "flow-handoff-rollback",
    primaryItemId: item.id,
    skipSitrep: true,
    skipLog: true,
    quiet: true,
    confineAdapterWrites: true,
    expectedRevision: before.revision,
  });
  if (!writeResult.ok)
    return rejected(
      workspaceRoot,
      before,
      "ROLLBACK_WRITE_FAILED",
      writeResult.error ?? "Falha ao desfazer handoff.",
      input,
      subject,
    );
  const after = directionForOperation(workspaceRoot, input);
  const entry = audit(workspaceRoot, "handoff_rollback", before, {
    outcome: "accepted",
    reasonCode: "HANDOFF_ROLLED_BACK",
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
    details: {
      previousFrom,
      previousTo,
      previousExecutor,
      afterRevision: after.revision,
      cancelledHandoff: true,
    },
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(
      before,
      entry.id,
      "accepted",
      "HANDOFF_ROLLED_BACK",
      input.reason,
      after,
    ),
  );
}

function appendReviewAcceptanceCriteria(
  specPath: string,
  acceptancePath: string | null,
  criteria: RequestReworkInput["acceptanceCriteria"],
): string[] {
  const current = readFileSync(specPath, "utf8");
  const used = new Set(
    [...current.matchAll(/\bAC(\d+)\b/gi)].map((match) => `AC${match[1]}`),
  );
  let next = Math.max(0, ...[...used].map((id) => Number(id.slice(2)))) + 1;
  const normalized = criteria.map((criterion) => {
    const description = criterion.description.trim();
    if (!description)
      throw new Error("Todo apontamento de retrabalho precisa de descrição.");
    let id = criterion.id?.trim().toUpperCase();
    if (id && !/^AC\d+$/.test(id))
      throw new Error(`Identificador de AC inválido: ${id}.`);
    if (!id) {
      while (used.has(`AC${next}`)) next += 1;
      id = `AC${next++}`;
    }
    if (used.has(id)) throw new Error(`O critério ${id} já existe na spec.`);
    used.add(id);
    return { id, description };
  });
  const block = [
    "",
    "## Retorno de revisão",
    "",
    ...normalized.map(
      ({ id, description }) =>
        `- [ ] **${id} — Correção de revisão**: ${description}`,
    ),
    "",
  ].join("\n");
  const nextSpec = `${current.trimEnd()}\n${block}`;
  const acceptance =
    acceptancePath && existsSync(acceptancePath)
      ? readFileSync(acceptancePath, "utf8")
      : null;
  const nextAcceptance =
    acceptance === null ? null : `${acceptance.trimEnd()}\n${block}`;

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
export async function requestReworkOperation(
  root: string,
  input: RequestReworkInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "request_rework",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "request_rework" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim()) {
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Retrabalho exige identidade do actor.",
      input,
      subject,
    );
  }
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  if (!workflow || !item) {
    return rejected(
      workspaceRoot,
      before,
      "ITEM_NOT_FOUND",
      "Item não encontrado.",
      input,
      subject,
    );
  }
  // YAML-driven: read rework config from flow definition
  const activeFlowForRework = resolveActiveFlow(workspaceRoot).flow;
  const sourceStageDef = activeFlowForRework?.stages.find(
    (s) => s.id === item.stage,
  );
  if (!sourceStageDef?.rework) {
    return rejected(
      workspaceRoot,
      before,
      "REWORK_NOT_ALLOWED",
      `O estágio "${item.stage}" não possui configuração de retrabalho.`,
      input,
      subject,
    );
  }
  const resolvedReworkActor = resolveMcpActor(
    workspaceRoot,
    (input.actor ?? "").trim(),
    item.stage,
  );
  const isAllowedActor =
    !sourceStageDef.rework.allowed_actors?.length ||
    sourceStageDef.rework.allowed_actors.includes(resolvedReworkActor);
  if (!isAllowedActor) {
    return rejected(
      workspaceRoot,
      before,
      "REWORK_ACTOR_REQUIRED",
      `O actor "${resolvedReworkActor}" não está autorizado a solicitar retrabalho neste estágio.`,
      input,
      subject,
    );
  }
  const reworkOperation = activeFlowForRework?.operations.rework;
  if (
    reworkOperation?.requiresClaim === true &&
    item.claimedBy !== resolvedReworkActor
  ) {
    return rejected(
      workspaceRoot,
      before,
      "CLAIM_REQUIRED",
      "O actor precisa possuir o claim vigente antes de solicitar retrabalho.",
      input,
      subject,
    );
  }
  const mustCreateAcceptanceCriteria = sourceStageDef.rework.create_ac === true;
  if (mustCreateAcceptanceCriteria && input.acceptanceCriteria.length === 0)
    return rejected(
      workspaceRoot,
      before,
      "REWORK_ACCEPTANCE_REQUIRED",
      "A configuração de retrabalho exige ao menos um critério de aceitação.",
      input,
      subject,
    );
  // YAML-driven: read rework target from flow definition
  const reworkTargetStage = activeFlowForRework?.stages.find(
    (s) => s.id === sourceStageDef.rework!.target,
  );
  if (!reworkTargetStage || !item.spec) {
    return rejected(
      workspaceRoot,
      before,
      "REWORK_TARGET_UNAVAILABLE",
      "O fluxo não possui estágio de destino ou spec vinculada para registrar o retrabalho.",
      input,
      subject,
    );
  }
  const specPath = join(
    getLetraDir(workspaceRoot),
    "specs",
    item.spec,
    "spec.md",
  );
  if (!existsSync(specPath))
    return rejected(
      workspaceRoot,
      before,
      "ACTIVE_SPEC_REQUIRED",
      "A spec vinculada ao item não existe.",
      input,
      subject,
    );
  const acceptancePath = join(
    getLetraDir(workspaceRoot),
    "specs",
    item.spec,
    "acceptance.md",
  );
  let created: string[] = [];
  if (mustCreateAcceptanceCriteria) {
    try {
      created = appendReviewAcceptanceCriteria(
        specPath,
        acceptancePath,
        input.acceptanceCriteria,
      );
    } catch (error) {
      return rejected(
        workspaceRoot,
        before,
        "REWORK_AC_INVALID",
        error instanceof Error ? error.message : String(error),
        input,
        subject,
      );
    }
  }
  const now = new Date();
  const from = item.stage;
  // YAML-driven: use rework target stage and its first agent
  item.stage = reworkTargetStage.id;
  runClaimFreeEnterHooks(workspaceRoot, workflow, item, reworkTargetStage);
  const handoffTarget = reworkTargetStage.agents?.[0] ?? reworkTargetStage.id;
  item.handoff = {
    from: input.actor,
    to: handoffTarget,
    summary: `Retrabalho solicitado em ${sourceStageDef.name}: ${input.reason}`,
    evidence: created.map((id) => `spec:${item.spec}:${id}`),
    timestamp: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
  };
  item.claimedBy = undefined;
  item.claimedAt = undefined;
  item.claimExpiresAt = undefined;
  item.claimExecutorId = undefined;
  item.claimCapability = undefined;
  item.claimRevision = undefined;
  item.claimTtlMinutes = undefined;
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
  const expectedRevision = directionForOperation(workspaceRoot, input).revision;
  const writeResult = await writeWorkflow(workspaceRoot, {
    workflow,
    source: "flow-handoff",
    primaryItemId: item.id,
    skipSitrep: true,
    skipLog: true,
    quiet: true,
    confineAdapterWrites: true,
    expectedRevision,
  });
  if (!writeResult.ok)
    return rejected(
      workspaceRoot,
      before,
      "REWORK_WRITE_FAILED",
      writeResult.error ?? "Falha ao persistir o retorno para retrabalho.",
      input,
      subject,
    );
  if (item.spec)
    writeFocusWithRecommendations(workspaceRoot, item.spec, item.id);
  const after = directionForOperation(workspaceRoot, input);
  const entry = audit(workspaceRoot, "agent_transition_requested", before, {
    outcome: "accepted",
    reasonCode: "REWORK_REQUESTED",
    reason: input.reason,
    actor: input.actor,
    itemId: item.id,
    details: {
      from,
      to: reworkTargetStage.id,
      handoffTo: handoffTarget,
      createdAcceptanceCriteria: created,
      afterRevision: after.revision,
    },
  });
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(
      before,
      entry.id,
      "accepted",
      "REWORK_REQUESTED",
      input.reason,
      after,
    ),
  );
}

export async function decideGateOperation(
  root: string,
  input: GateDecisionInput,
): Promise<OperationResult> {
  const invalid = guardInvalidWorkspace(root, input, {
    itemId: input.itemId,
    operation: "gate_decision",
  });
  if (invalid) return invalid;
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  try {
    assertOperationLevel(
      workspaceRoot,
      input.actor ?? "",
      OPERATION_REQUIRED_LEVELS["gate.decision"],
      {
        operation: "gate.decision",
        details: {
          itemId: input.itemId,
          decision: input.decision,
          expectedRevision: input.expectedRevision,
          reason: input.reason,
        },
        proof: input.proof,
      },
    );
  } catch (error) {
    return rejected(
      workspaceRoot,
      directionForOperation(workspaceRoot, input),
      "SIGNED_OPERATION_REQUIRED",
      error instanceof Error ? error.message : String(error),
      input,
      { itemId: input.itemId, operation: "gate_decision" },
    );
  }
  const replay = replayIdempotent(workspaceRoot, input);
  if (replay) return replay;
  const before = directionForOperation(workspaceRoot, input);
  const subject = { itemId: input.itemId, operation: "gate_decision" };
  const stale = checkRevision(workspaceRoot, before, input, subject);
  if (stale) return stale;
  if (!input.actor?.trim())
    return rejected(
      workspaceRoot,
      before,
      "ACTOR_REQUIRED",
      "Decisão de gate exige identidade humana.",
      input,
      subject,
    );
  const workflow = loadWorkflow(workspaceRoot);
  const item = workflow?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  const flow = resolveActiveFlow(
    workspaceRoot,
    item
      ? { itemId: item.id, workflowVersionId: item.workflowVersionId }
      : undefined,
  ).flow;
  const gate = flow?.stages.find((stage) => stage.id === item?.stage)?.gate;
  if (
    !workflow ||
    !item ||
    !flow ||
    !gate ||
    gate.type !== "human" ||
    !gate.blocking
  )
    return rejected(
      workspaceRoot,
      before,
      "GATE_NOT_WAITING",
      "Item não está aguardando gate humano bloqueante.",
      input,
      subject,
    );
  const targetRule = gate.decisions?.[input.decision];
  const targetStageId = targetRule
    ? resolveDecisionTargetStage(flow.stages, item.stage, targetRule)
    : null;
  if (!targetStageId)
    return rejected(
      workspaceRoot,
      before,
      "INVALID_GATE_DECISION",
      "Decisão não possui destino válido no harness.",
      input,
      subject,
    );
  const targetStage = flow.stages.find((stage) => stage.id === targetStageId);
  const targetActor = targetStage?.roles[0]?.id;
  const sourceStage = item.stage;
  item.stage = targetStageId;
  runClaimFreeEnterHooks(workspaceRoot, workflow, item, targetStage);
  item.handoff = targetActor
    ? {
        from: input.actor,
        to: targetActor,
        summary: `Gate ${gate.name}: ${input.decision}`,
        evidence: [`gate:${gate.id}:${input.decision}`],
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      }
    : undefined;
  item.claimedBy = undefined;
  item.claimedAt = undefined;
  item.claimExpiresAt = undefined;
  item.claimExecutorId = undefined;
  item.claimCapability = undefined;
  item.claimRevision = undefined;
  item.claimTtlMinutes = undefined;
  workflow.updatedAt = new Date().toISOString();
  const nowIso = new Date().toISOString();
  const dataRoot = getLetraDir(workspaceRoot);
  const workflowPath = join(dataRoot, "workflow.json");
  const workflowRaw = readFileSync(workflowPath, "utf8");
  const runsPath = join(dataRoot, "runtime", "runs.json");
  const runsRaw = existsSync(runsPath) ? readFileSync(runsPath, "utf8") : null;
  const runsStore =
    runsRaw === null
      ? { schemaVersion: 1, runs: [] as RunEntity[] }
      : (JSON.parse(runsRaw) as { schemaVersion: number; runs: RunEntity[] });
  const waitingRuns = runsStore.runs.filter(
    (run) => run.itemId === item.id && run.status === "waiting-human",
  );
  if (waitingRuns.length > 1)
    return rejected(
      workspaceRoot,
      before,
      "RUN_SELECTION_REQUIRED",
      "Mais de uma Run aguarda este gate humano; selecione uma Run antes de retomar.",
      input,
      subject,
    );
  const waitingRun = waitingRuns[0];
  let nextRun: RunEntity | undefined;
  if (waitingRun) {
    if (
      waitingRun.workflowVersionId !== item.workflowVersionId ||
      waitingRun.workflowStageId !== sourceStage
    )
      return rejected(
        workspaceRoot,
        before,
        "RUN_BINDING_MISMATCH",
        "A Run em espera não corresponde à versão e ao estágio do gate.",
        input,
        subject,
      );
    if (input.decision === "approve") {
      nextRun = {
        ...waitingRun,
        authorization: {
          kind: "handoff",
          actorId: targetActor ?? input.actor,
          referenceId: `gate:${gate.id}:${input.itemId}:${nowIso}`,
          grantedAt: nowIso,
          revision: before.revision,
        },
        workflowStageId: targetStageId,
        cycle: { ...waitingRun.cycle, endedAt: nowIso },
        lease: null,
        revision: waitingRun.revision + 1,
        updatedAt: nowIso,
        status: "queued",
        gateDecisions: [
          ...waitingRun.gateDecisions,
          {
            id: `decision-${randomUUID()}`,
            itemId: item.id,
            gateId: gate.id,
            decision: input.decision,
            decidedBy: input.actor,
            decidedAt: nowIso,
          },
        ],
      };
    } else {
      nextRun = {
        ...waitingRun,
        revision: waitingRun.revision + 1,
        updatedAt: nowIso,
        status: "failed",
        result: {
          outcome: "failed",
          finishedAt: nowIso,
          summary: `Gate ${gate.name}: ${input.decision}`,
          evidenceIds: [`gate:${gate.id}:${input.decision}`],
        },
        gateDecisions: [
          ...waitingRun.gateDecisions,
          {
            id: `decision-${randomUUID()}`,
            itemId: item.id,
            gateId: gate.id,
            decision: input.decision,
            decidedBy: input.actor,
            decidedAt: nowIso,
          },
        ],
      };
    }
  }
  workflow.updatedAt = nowIso;
  const entry = createLogEntry("decision", input.reason, {
    by: input.actor,
    itemId: item.id,
    details: {
      outcome: "accepted",
      reasonCode: "GATE_DECISION_RECORDED",
      gateId: gate.id,
      decision: input.decision,
      from: sourceStage,
      to: targetStageId,
      runId: nextRun?.id,
    },
  });
  const sha = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  try {
    commitWorkspaceTransaction(workspaceRoot, {
      transactionId: `gate-${randomUUID()}`,
      writes: [
        {
          path: workflowPath,
          expectedHash: sha(workflowRaw),
          contents: JSON.stringify(workflow, null, 2),
        },
        ...(nextRun
          ? [
              {
                path: runsPath,
                expectedHash: runsRaw === null ? null : sha(runsRaw),
                contents:
                  JSON.stringify(
                    {
                      ...runsStore,
                      runs: runsStore.runs.map((run) =>
                        run.id === nextRun!.id ? nextRun! : run,
                      ),
                    },
                    null,
                    2,
                  ) + "\n",
              },
            ]
          : []),
      ],
      appends: [
        {
          path: jsonlPathForDate(workspaceRoot, new Date(entry.timestamp)),
          dedupeToken: entry.id,
          line: JSON.stringify(entry),
        },
      ],
      validate: () => {
        if (
          before.revision !==
          directionForOperation(workspaceRoot, input).revision
        )
          throw new Error("DIRECTION_STALE");
      },
    });
  } catch (error) {
    return rejected(
      workspaceRoot,
      before,
      "GATE_DECISION_WRITE_FAILED",
      error instanceof Error ? error.message : "Falha ao persistir decisão.",
      input,
      subject,
    );
  }
  const after = directionForOperation(workspaceRoot, input);
  return rememberIdempotent(
    workspaceRoot,
    input,
    result(
      before,
      entry.id,
      "accepted",
      "GATE_DECISION_RECORDED",
      input.reason,
      after,
    ),
  );
}

/** Explicitly migrate one Run to a validated, already-published workflow version. */
export function migrateRunWorkflowOperation(
  root: string,
  input: MigrateRunWorkflowInput,
): OperationResult {
  const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
  const workspaceId =
    resolveDataDir(workspaceRoot) ?? getLetraDir(workspaceRoot);
  const run = readExecutionRuns(workspaceRoot).runs.find(
    (entry) => entry.id === input.runId,
  );
  let initial: AgentDirectionSnapshot;
  try {
    initial = resolveOperationDirection(workspaceRoot, { runId: input.runId });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("WORKFLOW_VERSION_NOT_FOUND:")
    ) {
      const workflow = loadWorkflow(workspaceRoot);
      const item =
        workflow?.items.find((candidate) => candidate.id === run?.itemId) ??
        null;
      initial = createAgentDirectionSnapshot({
        workspaceRoot,
        workflow,
        flow: null,
        specContent: null,
        currentItemId: item?.id ?? null,
      });
    } else {
      throw error;
    }
  }
  const subject = { operation: "run_workflow_migration" };
  const signedDetails = {
    runId: input.runId,
    toWorkflowVersionId: input.toWorkflowVersionId,
    toStageId: input.toStageId,
    expectedRunRevision: input.expectedRunRevision,
    expectedDirectionRevision: input.expectedRevision,
    reason: input.reason,
  };
  try {
    assertOperationLevel(workspaceRoot, input.actor ?? "", "signed", {
      operation: "run.workflow.migrate",
      details: signedDetails,
      proof: input.proof,
    });
  } catch (error) {
    return rejected(
      workspaceRoot,
      initial,
      "SIGNED_OPERATION_REQUIRED",
      error instanceof Error ? error.message : String(error),
      input,
      subject,
    );
  }
  const stale = checkRevision(workspaceRoot, initial, input, subject);
  if (stale) return stale;
  if (!input.reason.trim())
    return rejected(
      workspaceRoot,
      initial,
      "MIGRATION_REASON_REQUIRED",
      "Migração de workflow exige motivo.",
      input,
      subject,
    );
  const current = readExecutionRuns(workspaceRoot).runs.find(
    (run) => run.id === input.runId,
  );
  if (!current)
    return rejected(
      workspaceRoot,
      initial,
      "RUN_NOT_FOUND",
      `Run não encontrada: ${input.runId}`,
      input,
      subject,
    );
  if (current.workspaceId !== workspaceId)
    return rejected(
      workspaceRoot,
      initial,
      "RUN_WORKSPACE_MISMATCH",
      "A Run pertence a outro workspace.",
      input,
      subject,
    );
  if (current.revision !== input.expectedRunRevision)
    return rejected(
      workspaceRoot,
      initial,
      "RUN_REVISION_CONFLICT",
      `Revisão atual da Run é ${current.revision}.`,
      input,
      subject,
    );
  if (current.workflowVersionId === input.toWorkflowVersionId)
    return rejected(
      workspaceRoot,
      initial,
      "WORKFLOW_VERSION_UNCHANGED",
      "A Run já está vinculada a esta versão.",
      input,
      subject,
    );
  try {
    const store = readExecutionRuns(workspaceRoot);
    const currentVersion = store.runs.find(
      (run) => run.id === input.runId,
    )?.workflowVersionId;
    if (!currentVersion)
      return rejected(
        workspaceRoot,
        initial,
        "RUN_NOT_FOUND",
        `Run não encontrada: ${input.runId}`,
        input,
        subject,
      );
    const source = findWorkflowVersionById(workspaceRoot, currentVersion);
    const target = findWorkflowVersionById(
      workspaceRoot,
      input.toWorkflowVersionId,
    );
    if (!source || !target || target.status !== "published")
      return rejected(
        workspaceRoot,
        initial,
        "WORKFLOW_VERSION_NOT_PUBLISHED",
        "A versão destino precisa existir e estar publicada.",
        input,
        subject,
      );
    if (source.workflowId !== target.workflowId)
      return rejected(
        workspaceRoot,
        initial,
        "WORKFLOW_DEFINITION_MISMATCH",
        "Migração entre definições de workflow diferentes não é suportada.",
        input,
        subject,
      );
    const validation = validateWorkflowContent(target.content);
    if (!validation.valid)
      return rejected(
        workspaceRoot,
        initial,
        "WORKFLOW_VERSION_INVALID",
        JSON.stringify(validation.errors),
        input,
        subject,
      );
    const targetStage = target.content.stages.find(
      (stage) => stage.id === input.toStageId,
    );
    if (!targetStage)
      return rejected(
        workspaceRoot,
        initial,
        "WORKFLOW_STAGE_NOT_FOUND",
        `Estágio não existe na versão destino: ${input.toStageId}`,
        input,
        subject,
      );
    const sourceStageId = current.workflowStageId ?? "";
    const migratedAt = new Date().toISOString();
    const nextRunRevision = current.revision + 1;
    const nextDirectionRevision = `sha256:${createHash("sha256")
      .update(
        JSON.stringify({
          runId: current.id,
          itemId: current.itemId,
          workflowVersionId: target.id,
          stageId: input.toStageId,
          revision: nextRunRevision,
        }),
      )
      .digest("hex")}`;
    const nextRun = updateExecutionRun(
      workspaceRoot,
      current.id,
      input.expectedRunRevision,
      (run) => ({
        ...run,
        workflowVersionId: target.id,
        workflowStageId: input.toStageId,
        directionRevision: nextDirectionRevision,
        revision: nextRunRevision,
        updatedAt: migratedAt,
        workflowMigrationHistory: [
          ...(run.workflowMigrationHistory ?? []),
          {
            fromWorkflowVersionId: run.workflowVersionId,
            toWorkflowVersionId: target.id,
            fromStageId: sourceStageId,
            toStageId: input.toStageId,
            actorId: input.actor!,
            reason: input.reason.trim(),
            migratedAt,
            revision: run.revision + 1,
          },
        ],
      }),
    );
    const after = initial;
    const entry = audit(workspaceRoot, "agent_execution_event", initial, {
      outcome: "accepted",
      reasonCode: "RUN_WORKFLOW_MIGRATED",
      reason: input.reason,
      actor: input.actor,
      itemId: nextRun.itemId,
      details: {
        runId: nextRun.id,
        fromWorkflowVersionId: current.workflowVersionId,
        toWorkflowVersionId: target.id,
        fromStageId: sourceStageId,
        toStageId: input.toStageId,
        previousRunRevision: current.revision,
        runRevision: nextRun.revision,
      },
    });
    return result(
      initial,
      entry.id,
      "accepted",
      "RUN_WORKFLOW_MIGRATED",
      input.reason,
      after,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.startsWith("RUN_REVISION_CONFLICT")
      ? "RUN_REVISION_CONFLICT"
      : message.startsWith("WORKFLOW_VERSION_NOT_FOUND")
        ? "WORKFLOW_VERSION_NOT_FOUND"
        : "RUN_WORKFLOW_MIGRATION_FAILED";
    return rejected(workspaceRoot, initial, code, message, input, subject);
  }
}

function findWorkflowVersionById(root: string, versionId: string) {
  for (const definition of listWorkflowDefinitions(root)) {
    for (const version of listWorkflowVersions(root, definition.id)) {
      if (version.id === versionId) return version;
    }
  }
  return null;
}
