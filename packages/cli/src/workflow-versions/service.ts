import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLetraDir } from "../workspace/resolver.js";
import { logEntry } from "../session-log.js";
import { assertOperationLevel } from "../identity/guard.js";

export type WorkflowVersionStatus = "draft" | "published" | "superseded";
export interface WorkflowDefinitionContent { name: string; description?: string; initialStageId?: string; stages: Array<{ id: string; final?: boolean; transitions?: Array<{ target: string }>; [key: string]: unknown }>; [key: string]: unknown }

export interface WorkflowVersion { id: string; workflowId: string; number: number | null; status: WorkflowVersionStatus; basedOnVersionId: string | null; restoredFromVersionId?: string; schemaVersion: "1"; content: WorkflowDefinitionContent; contentHash: string; revision: number; changeSummary?: string; createdBy: string; createdAt: string; publishedBy?: string; publishedAt?: string }
export interface WorkflowDefinition { id: string; name: string; description?: string; activeVersionId: string | null; draftVersionId: string | null; nextVersionNumber: number; createdAt: string; updatedAt: string }
export interface WorkflowValidation { valid: boolean; errors: Array<{ code: string; message: string; path?: string }> }

const stable = (value: unknown): string => {
	if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
	if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(",")}}`;
	return JSON.stringify(value);
};
export const workflowContentHash = (content: WorkflowDefinitionContent): string => createHash("sha256").update(stable(content)).digest("hex");
const baseDir = (root: string) => join(getLetraDir(root), "workflow-definitions");
function assertIdentifier(id: string): string { if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(id) || id.includes("..")) throw new Error("WORKFLOW_ID_INVALID"); return id; }
function assertVersionNumber(number: number): number { if (!Number.isSafeInteger(number) || number < 1) throw new Error("WORKFLOW_VERSION_INVALID"); return number; }
const definitionDir = (root: string, id: string) => join(baseDir(root), assertIdentifier(id));
const indexPath = (root: string, id: string) => join(definitionDir(root, id), "index.json");
const draftPath = (root: string, id: string) => join(definitionDir(root, id), "draft.json");
const versionPath = (root: string, id: string, number: number) => join(definitionDir(root, id), "versions", `v${assertVersionNumber(number)}.json`);
const draftRevisionPath = (root: string, id: string, revision: number) => join(definitionDir(root, id), "draft-revisions", `r${revision}.json`);
const publicationTransactionPath = (root: string, id: string) => join(definitionDir(root, id), "publication.transaction.json");
const draftTransactionPath = (root: string, id: string) => join(definitionDir(root, id), "draft.transaction.json");

function atomicJson(path: string, value: unknown): void { const temp = `${path}.tmp-${process.pid}-${Date.now()}`; writeFileSync(temp, JSON.stringify(value, null, 2), "utf8"); renameSync(temp, path); }
function readJson<T>(path: string): T { return JSON.parse(readFileSync(path, "utf8")) as T; }

interface PublicationTransaction { operation: "publish"; workflowId: string; number: number; previousVersionId: string | null; draft: WorkflowVersion; published: WorkflowVersion; originalDefinition: WorkflowDefinition; startedAt: string; reason: string; actor: string }
interface DraftTransaction { operation: "create_draft" | "discard_draft"; workflowId: string; draftId: string; draft: WorkflowVersion | null; originalDefinition: WorkflowDefinition; updatedDefinition: WorkflowDefinition; startedAt: string; actor: string }

function loadDefinitionRaw(root: string, id: string): WorkflowDefinition { if (!existsSync(indexPath(root, id))) throw new Error("WORKFLOW_DEFINITION_NOT_FOUND"); return readJson(indexPath(root, id)); }

function recoverPendingPublication(root: string, id: string): void {
	const transactionPath = publicationTransactionPath(root, id);
	if (!existsSync(transactionPath)) return;
	const transaction = readJson<PublicationTransaction>(transactionPath);
	const snapshot = versionPath(root, id, transaction.number);
	const current = existsSync(indexPath(root, id)) ? readJson<WorkflowDefinition>(indexPath(root, id)) : null;
	const committed = current?.activeVersionId === transaction.published.id && existsSync(snapshot);
	if (committed) {
		try { if (existsSync(draftPath(root, id))) unlinkSync(draftPath(root, id)); } catch {}
		logEntry(root, "system", `Recovered workflow ${id} publication v${transaction.number}`, { details: { actor: transaction.actor, reason: transaction.reason, versionId: transaction.published.id, previousVersionId: transaction.previousVersionId, contentHash: transaction.published.contentHash } });
		try { unlinkSync(transactionPath); } catch {}
		return;
	}
	atomicJson(indexPath(root, id), transaction.originalDefinition);
	try { if (existsSync(snapshot)) unlinkSync(snapshot); } catch {}
	if (!existsSync(draftPath(root, id))) atomicJson(draftPath(root, id), transaction.draft);
	logEntry(root, "system", `Recovered workflow ${id} publication rollback`, { details: { actor: transaction.actor, reason: transaction.reason, versionId: transaction.published.id, previousVersionId: transaction.previousVersionId } });
	try { unlinkSync(transactionPath); } catch {}
}

function recoverPendingDraftTransaction(root: string, id: string): void {
	const transactionPath = draftTransactionPath(root, id);
	if (!existsSync(transactionPath)) return;
	const transaction = readJson<DraftTransaction>(transactionPath);
	const current = existsSync(indexPath(root, id)) ? readJson<WorkflowDefinition>(indexPath(root, id)) : null;

	if (transaction.operation === "create_draft") {
		const draftFilePath = draftPath(root, id);
		const committed = current?.draftVersionId === transaction.draftId && existsSync(draftFilePath);
		if (committed) {
			const revPath = draftRevisionPath(root, id, 1);
			if (transaction.draft && !existsSync(revPath)) {
				atomicJson(revPath, transaction.draft);
			}
			logEntry(root, "system", `Recovered workflow ${id} draft creation ${transaction.draftId}`, { details: { actor: transaction.actor, workflowId: id, draftId: transaction.draftId } });
			try { unlinkSync(transactionPath); } catch {}
			return;
		}
		atomicJson(indexPath(root, id), transaction.originalDefinition);
		try { if (existsSync(draftFilePath)) unlinkSync(draftFilePath); } catch {}
		const revPath = draftRevisionPath(root, id, 1);
		try { if (existsSync(revPath)) unlinkSync(revPath); } catch {}
		logEntry(root, "system", `Recovered workflow ${id} draft creation rollback`, { details: { actor: transaction.actor, workflowId: id, draftId: transaction.draftId } });
		try { unlinkSync(transactionPath); } catch {}
		return;
	}

	if (transaction.operation === "discard_draft") {
		const draftFilePath = draftPath(root, id);
		const committed = current?.draftVersionId === null && !existsSync(draftFilePath);
		if (committed) {
			logEntry(root, "system", `Recovered workflow ${id} draft discard`, { details: { actor: transaction.actor, workflowId: id } });
			try { unlinkSync(transactionPath); } catch {}
			return;
		}
		atomicJson(indexPath(root, id), transaction.originalDefinition);
		if (transaction.draft && !existsSync(draftFilePath)) {
			atomicJson(draftFilePath, transaction.draft);
		}
		logEntry(root, "system", `Recovered workflow ${id} draft discard rollback`, { details: { actor: transaction.actor, workflowId: id } });
		try { unlinkSync(transactionPath); } catch {}
	}
}

function recoverAllPendingTransactions(root: string, id: string): void {
	recoverPendingPublication(root, id);
	recoverPendingDraftTransaction(root, id);
}

function loadDefinition(root: string, id: string): WorkflowDefinition { recoverAllPendingTransactions(root, id); return loadDefinitionRaw(root, id); }
function loadDraft(root: string, id: string): WorkflowVersion { recoverAllPendingTransactions(root, id); if (!existsSync(draftPath(root, id))) throw new Error("WORKFLOW_DRAFT_NOT_FOUND"); return readJson(draftPath(root, id)); }

export interface WorkflowValidationOptions {
	harness?: any;
	existingWorkflow?: any;
}

export function validateWorkflowContent(
	content: WorkflowDefinitionContent,
	options?: WorkflowValidationOptions,
): WorkflowValidation {
	const errors: WorkflowValidation["errors"] = [];
	if (!content || typeof content !== "object") {
		return { valid: false, errors: [{ code: "SCHEMA_INVALID", message: "content must be an object" }] };
	}
	if (!content.name?.trim()) {
		errors.push({ code: "WORKFLOW_NAME_REQUIRED", message: "workflow name is required", path: "name" });
	}
	if (!Array.isArray(content.stages)) {
		errors.push({ code: "SCHEMA_INVALID", message: "stages must be an array", path: "stages" });
		return { valid: false, errors };
	}

	const stages = content.stages as Array<Record<string, any>>;
	const ids = new Set<string>();
	const finalStageIds = new Set<string>();

	for (const [index, stage] of stages.entries()) {
		if (!stage.id?.trim()) {
			errors.push({ code: "STAGE_ID_REQUIRED", message: "stage id is required", path: `stages.${index}.id` });
		} else if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(stage.id) || stage.id.includes("..")) {
			errors.push({ code: "STAGE_ID_INVALID", message: `stage id ${stage.id} is invalid`, path: `stages.${index}.id` });
		} else if (ids.has(stage.id)) {
			errors.push({ code: "DUPLICATE_STAGE_ID", message: `duplicate stage ${stage.id}`, path: `stages.${index}.id` });
		} else {
			ids.add(stage.id);
			if (stage.final) finalStageIds.add(stage.id);
		}

		// Validate gate
		if (stage.gate) {
			if (typeof stage.gate === "object") {
				const gate = stage.gate;
				if (!gate.id?.trim()) {
					errors.push({ code: "GATE_ID_REQUIRED", message: `gate on stage ${stage.id} requires an id`, path: `stages.${index}.gate.id` });
				}
				if (gate.type && !["human", "automated", "external"].includes(gate.type)) {
					errors.push({ code: "GATE_TYPE_INVALID", message: `gate type ${gate.type} on stage ${stage.id} is invalid`, path: `stages.${index}.gate.type` });
				}
				if (gate.type === "human" && (!gate.decisions || Object.keys(gate.decisions).length === 0)) {
					errors.push({ code: "HUMAN_GATE_DECISIONS_REQUIRED", message: `human gate on stage ${stage.id} requires decisions`, path: `stages.${index}.gate.decisions` });
				}
			} else if (typeof stage.gate === "string") {
				const gateId = stage.gate.replace(/^.*[\\/]/, "").replace(/\.ya?ml$/, "");
				if (options?.harness?.gates && !options.harness.gates[gateId]) {
					errors.push({ code: "GATE_NOT_FOUND", message: `gate ${gateId} referenced by stage ${stage.id} not found in harness`, path: `stages.${index}.gate` });
				}
			}
		}

		// Validate preferred executor
		if (stage.preferredExecutor !== undefined) {
			if (typeof stage.preferredExecutor !== "string" || !stage.preferredExecutor.trim()) {
				errors.push({ code: "EXECUTOR_ID_INVALID", message: `preferredExecutor on stage ${stage.id} must be a non-empty string`, path: `stages.${index}.preferredExecutor` });
			}
		}

		// Validate roles / allowed actors
		if (stage.allow !== undefined) {
			if (!Array.isArray(stage.allow)) {
				errors.push({ code: "ALLOW_LIST_INVALID", message: `allow on stage ${stage.id} must be an array of role IDs`, path: `stages.${index}.allow` });
			} else if (options?.harness?.roles) {
				for (const roleId of stage.allow) {
					if (typeof roleId === "string" && !options.harness.roles[roleId]) {
						errors.push({ code: "ROLE_NOT_FOUND", message: `role ${roleId} on stage ${stage.id} not found in harness`, path: `stages.${index}.allow` });
					}
				}
			}
		}

		// Validate phases
		if (stage.phases) {
			if (typeof stage.phases !== "object" || !stage.phases.states || typeof stage.phases.states !== "object") {
				errors.push({ code: "PHASE_SCHEMA_INVALID", message: `phases on stage ${stage.id} is invalid`, path: `stages.${index}.phases` });
			} else {
				const phaseStates = Object.keys(stage.phases.states);
				if (!stage.phases.initialState || !phaseStates.includes(stage.phases.initialState)) {
					errors.push({ code: "PHASE_INITIAL_STATE_INVALID", message: `initialState ${stage.phases.initialState} on stage ${stage.id} does not exist in phase states`, path: `stages.${index}.phases.initialState` });
				}
				for (const [phaseKey, phaseVal] of Object.entries(stage.phases.states) as Array<[string, any]>) {
					for (const transition of phaseVal.transitions ?? []) {
						if (!phaseStates.includes(transition.target)) {
							errors.push({ code: "PHASE_TRANSITION_TARGET_NOT_FOUND", message: `phase transition target ${transition.target} not found in stage ${stage.id}`, path: `stages.${index}.phases.states.${phaseKey}.transitions` });
						}
					}
				}
			}
		}

		// Validate hooks
		if (stage.hooks) {
			for (const hookList of [stage.hooks.on_enter, stage.hooks.on_exit]) {
				for (const hook of hookList ?? []) {
					if (!hook.action?.trim()) {
						errors.push({ code: "HOOK_ACTION_REQUIRED", message: `hook on stage ${stage.id} requires an action name`, path: `stages.${index}.hooks` });
					}
				}
			}
		}
	}

	if (stages.length === 0) {
		errors.push({ code: "STAGE_REQUIRED", message: "at least one stage is required" });
	}

	if (!content.initialStageId || !ids.has(content.initialStageId)) {
		errors.push({ code: "INITIAL_STAGE_INVALID", message: "initial stage must reference an existing stage", path: "initialStageId" });
	}

	if (finalStageIds.size === 0) {
		errors.push({ code: "FINAL_STAGE_REQUIRED", message: "at least one final stage is required" });
	}

	// Validate stage transitions
	for (const [index, stage] of stages.entries()) {
		for (const transition of stage.transitions ?? []) {
			if (!ids.has(transition.target)) {
				errors.push({ code: "TRANSITION_TARGET_NOT_FOUND", message: `transition target ${transition.target} does not exist`, path: `stages.${index}.transitions` });
			}
		}
	}

	// Validate reachability from initial stage
	if (content.initialStageId && ids.has(content.initialStageId)) {
		const reachable = new Set<string>();
		const queue = [content.initialStageId];
		while (queue.length) {
			const id = queue.shift()!;
			if (reachable.has(id)) continue;
			reachable.add(id);
			const stage = stages.find((entry) => entry.id === id);
			for (const transition of stage?.transitions ?? []) {
				if (!reachable.has(transition.target)) queue.push(transition.target);
			}
		}
		for (const stage of stages) {
			if (!reachable.has(stage.id)) {
				errors.push({ code: "STAGE_UNREACHABLE", message: `stage ${stage.id} is unreachable`, path: `stages.${stages.indexOf(stage)}` });
			}
		}
	}

	// Validate deadlocks / cycles without path to a final stage
	if (finalStageIds.size > 0) {
		for (const stage of stages) {
			if (stage.final) continue;
			const visited = new Set<string>();
			const queue = [stage.id];
			let canReachFinal = false;
			while (queue.length) {
				const currentId = queue.shift()!;
				if (finalStageIds.has(currentId)) {
					canReachFinal = true;
					break;
				}
				if (visited.has(currentId)) continue;
				visited.add(currentId);
				const currentStage = stages.find((entry) => entry.id === currentId);
				for (const transition of currentStage?.transitions ?? []) {
					if (!visited.has(transition.target)) queue.push(transition.target);
				}
			}
			if (!canReachFinal) {
				errors.push({
					code: "FINAL_STAGE_UNREACHABLE",
					message: `stage ${stage.id} has no path to reach a final stage`,
					path: `stages.${stages.indexOf(stage)}`,
				});
			}
		}
	}

	// Validate backward compatibility with existing active items if provided
	if (options?.existingWorkflow?.items) {
		const unpinnedItemsInMissingStages = options.existingWorkflow.items.filter(
			(item: any) => !item.workflowVersionId && item.stage && !ids.has(item.stage),
		);
		if (unpinnedItemsInMissingStages.length > 0) {
			errors.push({
				code: "STAGE_REMOVAL_ORPHANS_ITEMS",
				message: `removed stages contain unpinned active items: ${unpinnedItemsInMissingStages.map((i: any) => i.id).join(", ")}`,
			});
		}
	}

	return { valid: errors.length === 0, errors };
}

export function createWorkflowDefinition(root: string, input: { name: string; description?: string; actor: string; content?: WorkflowDefinitionContent; duplicateFrom?: { workflowId: string; versionNumber: number } }): { definition: WorkflowDefinition; draft: WorkflowVersion } {
	if (!input.actor?.trim()) throw new Error("ACTOR_REQUIRED");
	const id = `workflow-${randomUUID()}`; const now = new Date().toISOString();
	let content = input.content ?? { name: input.name, description: input.description, stages: [] };
	if (input.duplicateFrom) content = structuredClone(getWorkflowVersion(root, input.duplicateFrom.workflowId, input.duplicateFrom.versionNumber).content);
	const draft: WorkflowVersion = { id: `draft-${randomUUID()}`, workflowId: id, number: null, status: "draft", basedOnVersionId: null, schemaVersion: "1", content, contentHash: workflowContentHash(content), revision: 1, createdBy: input.actor, createdAt: now };
	const definition: WorkflowDefinition = { id, name: input.name, description: input.description, activeVersionId: null, draftVersionId: draft.id, nextVersionNumber: 1, createdAt: now, updatedAt: now };
	mkdirSync(baseDir(root), { recursive: true }); const staging = join(baseDir(root), `.create-${id}-${randomUUID()}`);
	try { mkdirSync(join(staging, "versions"), { recursive: true }); mkdirSync(join(staging, "draft-revisions"), { recursive: true }); atomicJson(join(staging, "draft.json"), draft); atomicJson(join(staging, "draft-revisions", "r1.json"), draft); atomicJson(join(staging, "index.json"), definition); renameSync(staging, definitionDir(root, id)); } catch (error) { rmSync(staging, { recursive: true, force: true }); throw error; }
	logEntry(root, "system", `Workflow definition ${id} created`, { details: { actor: input.actor, workflowId: id, draftId: draft.id } });
	return { definition, draft };
}

export function createWorkflowDraft(
	root: string,
	workflowId: string,
	actor: string,
	basedOnVersionNumber?: number,
	faultInjection?: { beforeCommit?: () => void; afterCommit?: () => void },
): WorkflowVersion {
	if (!actor?.trim()) throw new Error("ACTOR_REQUIRED");
	const definition = loadDefinition(root, workflowId);
	if (existsSync(draftPath(root, workflowId))) return loadDraft(root, workflowId);

	const base = basedOnVersionNumber
		? getWorkflowVersion(root, workflowId, basedOnVersionNumber)
		: definition.activeVersionId
		? listWorkflowVersions(root, workflowId).find((v) => v.id === definition.activeVersionId)
		: undefined;

	const content = structuredClone(
		base?.content ?? { name: definition.name, description: definition.description, stages: [] },
	);
	const now = new Date().toISOString();
	const draft: WorkflowVersion = {
		id: `draft-${randomUUID()}`,
		workflowId,
		number: null,
		status: "draft",
		basedOnVersionId: base?.id ?? null,
		schemaVersion: "1",
		content,
		contentHash: workflowContentHash(content),
		revision: 1,
		createdBy: actor,
		createdAt: now,
	};

	const originalDefinition = structuredClone(definition);
	const updatedDefinition: WorkflowDefinition = {
		...definition,
		draftVersionId: draft.id,
		updatedAt: now,
	};

	const transactionPath = draftTransactionPath(root, workflowId);
	atomicJson(transactionPath, {
		operation: "create_draft",
		workflowId,
		draftId: draft.id,
		draft,
		originalDefinition,
		updatedDefinition,
		startedAt: now,
		actor,
	} satisfies DraftTransaction);

	const revDir = join(definitionDir(root, workflowId), "draft-revisions");
	mkdirSync(revDir, { recursive: true });
	const rev1Path = draftRevisionPath(root, workflowId, 1);
	const draftFilePath = draftPath(root, workflowId);

	try {
		atomicJson(rev1Path, draft);
		atomicJson(draftFilePath, draft);
		faultInjection?.beforeCommit?.();
		atomicJson(indexPath(root, workflowId), updatedDefinition);
		faultInjection?.afterCommit?.();
	} catch (error) {
		atomicJson(indexPath(root, workflowId), originalDefinition);
		try { if (existsSync(draftFilePath)) unlinkSync(draftFilePath); } catch {}
		try { if (existsSync(rev1Path)) unlinkSync(rev1Path); } catch {}
		try { unlinkSync(transactionPath); } catch {}
		throw error;
	}

	logEntry(root, "system", `Workflow draft ${draft.id} created`, {
		details: { actor, workflowId, draftId: draft.id },
	});
	try { unlinkSync(transactionPath); } catch {}
	return draft;
}

export function discardWorkflowDraft(
	root: string,
	workflowId: string,
	actor: string,
	faultInjection?: { beforeCommit?: () => void; afterCommit?: () => void },
): void {
	if (!actor?.trim()) throw new Error("ACTOR_REQUIRED");
	const definition = loadDefinition(root, workflowId);
	if (!existsSync(draftPath(root, workflowId))) {
		throw new Error("WORKFLOW_DRAFT_NOT_FOUND");
	}
	const draft = loadDraft(root, workflowId);
	const now = new Date().toISOString();
	const originalDefinition = structuredClone(definition);
	const updatedDefinition: WorkflowDefinition = {
		...definition,
		draftVersionId: null,
		updatedAt: now,
	};

	const transactionPath = draftTransactionPath(root, workflowId);
	atomicJson(transactionPath, {
		operation: "discard_draft",
		workflowId,
		draftId: draft.id,
		draft,
		originalDefinition,
		updatedDefinition,
		startedAt: now,
		actor,
	} satisfies DraftTransaction);

	const draftFilePath = draftPath(root, workflowId);
	try {
		faultInjection?.beforeCommit?.();
		atomicJson(indexPath(root, workflowId), updatedDefinition);
		faultInjection?.afterCommit?.();
		unlinkSync(draftFilePath);
	} catch (error) {
		atomicJson(indexPath(root, workflowId), originalDefinition);
		if (!existsSync(draftFilePath)) atomicJson(draftFilePath, draft);
		try { unlinkSync(transactionPath); } catch {}
		throw error;
	}

	logEntry(root, "system", `Workflow draft ${draft.id} discarded`, {
		details: { actor, workflowId, draftId: draft.id },
	});
	try { unlinkSync(transactionPath); } catch {}
}

export function updateWorkflowDraft(root: string, workflowId: string, input: { expectedRevision: number; actor: string; content: WorkflowDefinitionContent; changeSummary?: string }): WorkflowVersion {
	const draft = loadDraft(root, workflowId); if (draft.revision !== input.expectedRevision) throw new Error(`DRAFT_REVISION_CONFLICT:${draft.revision}`);
	const next = { ...draft, content: structuredClone(input.content), contentHash: workflowContentHash(input.content), revision: draft.revision + 1, changeSummary: input.changeSummary };
	atomicJson(draftRevisionPath(root, workflowId, next.revision), next); atomicJson(draftPath(root, workflowId), next); logEntry(root, "system", `Workflow draft ${draft.id} updated`, { details: { actor: input.actor, workflowId, revision: next.revision } }); return next;
}

export function publishWorkflowDraft(root: string, workflowId: string, input: { expectedRevision: number; actor: string; reason: string; restoredFromVersionId?: string }, faultInjection?: { beforeActivation?: () => void; afterActivation?: () => void }): WorkflowVersion {
	assertOperationLevel(root, input.actor, "local");
	if (!input.actor.startsWith("human:") || !input.reason.trim()) throw new Error("HUMAN_PUBLICATION_REQUIRED");
	const definition = loadDefinition(root, workflowId); const draft = loadDraft(root, workflowId); if (draft.revision !== input.expectedRevision) throw new Error(`DRAFT_REVISION_CONFLICT:${draft.revision}`);
	const validation = validateWorkflowContent(draft.content); if (!validation.valid) throw new Error(`WORKFLOW_INVALID:${JSON.stringify(validation.errors)}`);
	const number = definition.nextVersionNumber; const now = new Date().toISOString();
	const published: WorkflowVersion = { ...draft, id: `version-${randomUUID()}`, number, status: "published", content: structuredClone(draft.content), contentHash: workflowContentHash(draft.content), publishedBy: input.actor, publishedAt: now, changeSummary: input.reason, restoredFromVersionId: input.restoredFromVersionId ?? draft.restoredFromVersionId };
	const snapshot = versionPath(root, workflowId, number); const transaction = publicationTransactionPath(root, workflowId); const previous = definition.activeVersionId; const originalDefinition = structuredClone(definition);
	atomicJson(transaction, { operation: "publish", workflowId, number, previousVersionId: previous, draft, published, originalDefinition, startedAt: now, actor: input.actor, reason: input.reason } satisfies PublicationTransaction);
	try {
		atomicJson(snapshot, published);
		faultInjection?.beforeActivation?.();
		definition.activeVersionId = published.id; definition.draftVersionId = null; definition.nextVersionNumber += 1; definition.updatedAt = now; atomicJson(indexPath(root, workflowId), definition);
		faultInjection?.afterActivation?.();
		unlinkSync(draftPath(root, workflowId));
	} catch (error) {
		atomicJson(indexPath(root, workflowId), originalDefinition); try { unlinkSync(snapshot); } catch {} if (!existsSync(draftPath(root, workflowId))) atomicJson(draftPath(root, workflowId), draft); try { unlinkSync(transaction); } catch {} throw error;
	}
	logEntry(root, "system", `Workflow ${workflowId} published as v${number}`, { details: { actor: input.actor, reason: input.reason, versionId: published.id, previousVersionId: previous, contentHash: published.contentHash } }); try { unlinkSync(transaction); } catch {} return published;
}

export function rollbackWorkflowVersion(root: string, workflowId: string, input: { versionNumber: number; actor: string; reason: string }): WorkflowVersion {
	assertOperationLevel(root, input.actor, "local");
	if (!input.actor.startsWith("human:") || !input.reason.trim()) throw new Error("HUMAN_ROLLBACK_REQUIRED"); const historic = getWorkflowVersion(root, workflowId, input.versionNumber);
	if (existsSync(draftPath(root, workflowId))) throw new Error("DRAFT_ALREADY_EXISTS"); const draft = createWorkflowDraft(root, workflowId, input.actor, input.versionNumber); draft.restoredFromVersionId = historic.id; atomicJson(draftPath(root, workflowId), draft);
	return publishWorkflowDraft(root, workflowId, { expectedRevision: draft.revision, actor: input.actor, reason: input.reason, restoredFromVersionId: historic.id });
}

export function listWorkflowDefinitions(root: string): WorkflowDefinition[] { if (!existsSync(baseDir(root))) return []; return readdirSync(baseDir(root), { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(indexPath(root, entry.name))).map((entry) => readJson(indexPath(root, entry.name))); }

/** Derives the live status of a version snapshot without mutating the immutable file on disk. */
function deriveVersionStatus(version: WorkflowVersion, activeVersionId: string | null): WorkflowVersionStatus {
	return version.id === activeVersionId ? "published" : "superseded";
}

export function listWorkflowVersions(root: string, workflowId: string): WorkflowVersion[] {
	const dir = join(definitionDir(root, workflowId), "versions");
	if (!existsSync(dir)) return [];
	const activeId = loadDefinition(root, workflowId).activeVersionId;
	return readdirSync(dir)
		.filter((file) => /^v\d+\.json$/.test(file))
		.map((file) => readJson<WorkflowVersion>(join(dir, file)))
		.map((version) => ({ ...version, status: deriveVersionStatus(version, activeId) }))
		.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

export function getWorkflowVersion(root: string, workflowId: string, number: number): WorkflowVersion {
	recoverAllPendingTransactions(root, workflowId);
	const path = versionPath(root, workflowId, number);
	if (!existsSync(path)) throw new Error("WORKFLOW_VERSION_NOT_FOUND");
	const snapshot = readJson<WorkflowVersion>(path);
	// Derive status from the live index rather than the stale value in the immutable snapshot.
	// This ensures getWorkflowVersion and listWorkflowVersions are always consistent.
	const definition = loadDefinitionRaw(root, workflowId);
	return { ...snapshot, status: deriveVersionStatus(snapshot, definition.activeVersionId) };
}

export function getWorkflowDraft(root: string, workflowId: string): WorkflowVersion { return loadDraft(root, workflowId); }
export function listWorkflowDraftRevisions(root: string, workflowId: string): WorkflowVersion[] { const dir = join(definitionDir(root, workflowId), "draft-revisions"); if (!existsSync(dir)) return []; return readdirSync(dir).filter((file) => /^r\d+\.json$/.test(file)).map((file) => readJson<WorkflowVersion>(join(dir, file))).sort((a, b) => a.revision - b.revision); }
export function getActiveWorkflowVersion(root: string, workflowId: string): WorkflowVersion | null { const definition = loadDefinition(root, workflowId); return definition.activeVersionId ? listWorkflowVersions(root, workflowId).find((version) => version.id === definition.activeVersionId) ?? null : null; }

