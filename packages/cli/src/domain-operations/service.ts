import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentDirectionSnapshot } from "@letra/types";
import { resolveAgentDirection } from "../agent-direction/service.js";
import { generateAdapters } from "../adapters/generate.js";
import { writeFocusWithRecommendations } from "../adapters/focus-recommendations.js";
import { loadWorkflow, writeWorkflow } from "../commands/flow-init.js";
import { validate, type ValidationSummary } from "../commands/validate.js";
import { resolveActiveFlow } from "../flow-definition/resolve.js";
import { createWorkspaceBoundary } from "../security/workspace-boundary.js";
import { logEntry, type LogAction } from "../session-log.js";
import { GateChecker } from "../harness/gate-checker.js";

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
}

interface OperationContext {
	expectedRevision: string;
	reason: string;
	actor?: string;
}

export interface CompleteAcInput extends OperationContext {
	acId: string;
	evidence: string[];
}

export interface RequestTransitionInput extends OperationContext {
	itemId: string;
	targetStageId: string;
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
	extra: Pick<OperationResult, "validation"> = {},
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
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const before = resolveAgentDirection(workspaceRoot);
	const stale = checkRevision(workspaceRoot, before, context, { operation: "validate" });
	if (stale) return stale;

	const validation = await validate(workspaceRoot, {
		format: "silent",
		exit: false,
		log: false,
	});
	const after = resolveAgentDirection(workspaceRoot);
	const entry = audit(workspaceRoot, "agent_validation_run", before, {
		outcome: validation.failed === 0 ? "accepted" : "rejected",
		reasonCode: validation.failed === 0 ? "VALIDATION_COMPLETED" : "VALIDATION_FAILED",
		reason: context.reason,
		actor: context.actor,
		itemId: before.item?.id,
		details: { validation },
	});
	return result(
		before,
		entry.id,
		validation.failed === 0 ? "accepted" : "rejected",
		validation.failed === 0 ? "VALIDATION_COMPLETED" : "VALIDATION_FAILED",
		context.reason,
		after,
		{ validation },
	);
}

export function completeAcOperation(root: string, input: CompleteAcInput): OperationResult {
	const boundary = createWorkspaceBoundary(resolve(root));
	const workspaceRoot = boundary.root;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: before.item?.id, acId: input.acId, operation: "complete_ac" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;

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

	const specDir = join(workspaceRoot, ".letra", "specs", spec);
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

	const specTmp = specPath + ".tmp";
	writeFileSync(specTmp, updatedSpec, "utf-8");
	renameSync(specTmp, specPath);
	if (updatedAcceptance) {
		const acceptanceTmp = acceptancePath + ".tmp";
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
		details: { spec, evidence, afterRevision: after.revision },
	});
	return result(before, entry.id, "accepted", "AC_COMPLETED", input.reason, after);
}

export async function requestTransitionOperation(
	root: string,
	input: RequestTransitionInput,
): Promise<OperationResult> {
	const workspaceRoot = createWorkspaceBoundary(resolve(root)).root;
	const before = resolveAgentDirection(workspaceRoot);
	const subject = { itemId: input.itemId, operation: "request_transition" };
	const stale = checkRevision(workspaceRoot, before, input, subject);
	if (stale) return stale;
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
	if (before.pendingAC) {
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
	if (before.allowedStageIds.length > 0 && !before.allowedStageIds.includes(target.id)) {
		return rejected(
			workspaceRoot,
			before,
			"STAGE_NOT_ALLOWED",
			"O papel vigente não permite transição para o estágio solicitado.",
			input,
			subject,
		);
	}

	const activeFlow = resolveActiveFlow(workspaceRoot).flow;
	const sourceDefinition = activeFlow?.stages.find((stage) => stage.id === item.stage);
	const targetDefinition = activeFlow?.stages.find((stage) => stage.id === target.id);
	const blockingGate = [sourceDefinition?.gate, targetDefinition?.gate].find((gate) => gate?.blocking);
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
			delete (enriched as unknown as Record<string, unknown>).pendingAC;
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
				"BLOCKING_GATE",
				gateResult.reason ?? `O gate "${blockingGate.name}" deve ser satisfeito antes da transição.`,
				input,
				subject,
			);
		}
	}

	const from = item.stage;
	item.stage = target.id;
	workflow.updatedAt = new Date().toISOString();
	const writeResult = await writeWorkflow(workspaceRoot, {
		workflow,
		source: "flow-move",
		primaryItemId: item.id,
		skipSitrep: true,
		skipLog: true,
		quiet: true,
		confineAdapterWrites: true,
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
		details: { from, to: target.id, afterRevision: after.revision },
	});
	return result(before, entry.id, "accepted", "TRANSITION_COMPLETED", input.reason, after);
}
