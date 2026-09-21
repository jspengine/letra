import type { IncomingMessage, ServerResponse } from "node:http";
import type { GateDecision, ResolvedFlowDefinition } from "@letra/types";
import type { Workflow } from "../../commands/flow-init.js";
import type { loadHealthRecord } from "../../health-record.js";
import type { logEntry } from "../../session-log.js";
import type { writeFocusFile } from "../../adapters/focus-sync.js";
import type { writeWorkflow } from "../../commands/flow-init.js";
import type { resolveActiveFlowFor } from "../../flow-definition/resolve.js";
import { HttpBodyError, readJson, routeParam, sendError, sendJson } from "../http.js";
import type { RouteHandler } from "../router.js";
import { activateWorkOperation, claimOperation, createItemOperation, decideGateOperation, deleteItemOperation, releaseClaimOperation, requestReworkOperation, requestTransitionOperation, runValidationOperation, updateItemOperation } from "../../domain-operations/service.js";
import { resolveAgentDirection } from "../../agent-direction/service.js";
import { resolveLocalIdentity } from "../../identity/service.js";
import type { HumanSessionGateway } from "../human-session.js";

export interface ItemRouteDependencies {
	writeWorkflow: typeof writeWorkflow;
	loadHealthRecord: typeof loadHealthRecord;
	writeFocusFile: typeof writeFocusFile;
	logEntry: typeof logEntry;
	resolveActiveFlow: typeof resolveActiveFlowFor;
	broadcast: () => void;
	fireWebhooks: (
		workspaceRoot: string,
		event: string,
		payload: Record<string, unknown>,
	) => Promise<void>;
	decideGateOperation?: typeof decideGateOperation;
	claimOperation?: typeof claimOperation;
	releaseClaimOperation?: typeof releaseClaimOperation;
	requestTransitionOperation?: typeof requestTransitionOperation;
	activateWorkOperation?: typeof activateWorkOperation;
	runValidationOperation?: typeof runValidationOperation;
	requestReworkOperation?: typeof requestReworkOperation;
	createItemOperation?: typeof createItemOperation;
	updateItemOperation?: typeof updateItemOperation;
	deleteItemOperation?: typeof deleteItemOperation;
	resolveHumanActor?: (req: IncomingMessage) => string | null;
}

interface CreateItemBody {
	id?: string;
	description?: string;
	stage?: string;
	actor?: string;
	expectedRevision?: string;
	reason?: string;
	idempotencyKey?: string;
}

interface UpdateItemBody {
	description?: string;
	stage?: string;
	actor?: string;
	expectedRevision?: string;
	idempotencyKey?: string;
	reason?: string;
	tasks?: Workflow["items"][number]["tasks"];
}

interface GateDecisionBody {
	decision?: GateDecision;
	reason?: string;
	actor?: string;
	expectedRevision?: string;
	idempotencyKey?: string;
}

interface ClaimBody {
	actor?: string;
	executorId?: string;
	capability?: string;
	expectedRevision?: string;
	idempotencyKey?: string;
}

interface ActivateWorkBody { actor?: string; expectedRevision?: string; reason?: string; }
interface ValidationOperationBody { actor?: string; expectedRevision?: string; reason?: string; }
interface ReworkBody { actor?: string; expectedRevision?: string; reason?: string; acceptanceCriteria?: Array<{ id?: string; description?: string }>; }

function resolveDecisionTarget(
	flow: ResolvedFlowDefinition,
	currentStageId: string,
	target: string,
): string | null {
	const currentIndex = flow.stages.findIndex((stage) => stage.id === currentStageId);
	if (currentIndex === -1) return null;
	if (target === "next") return flow.stages[currentIndex + 1]?.id ?? null;
	if (target === "previous") return flow.stages[currentIndex - 1]?.id ?? null;
	if (target === "first") return flow.stages[0]?.id ?? null;
	return flow.stages.some((stage) => stage.id === target) ? target : null;
}

function sendBodyError(error: unknown, res: Parameters<typeof sendError>[0]): void {
	if (error instanceof HttpBodyError) {
		sendError(res, error.status, error.message);
		return;
	}
	sendError(res, 400, (error as Error).message);
}

export function createItemRoutes(dependencies: ItemRouteDependencies): RouteHandler {
	return async (context) => {
		const { method, path, req, res, workspaceRoot, workflow } = context;
		if (path === "/api/operations/validate" && method === "POST") {
			try {
				if (!dependencies.runValidationOperation) {
					sendError(res, 503, "Canonical validation operation unavailable");
					return true;
				}
				const data = await readJson<ValidationOperationBody>(req);
				const operation = await dependencies.runValidationOperation(workspaceRoot, {
					expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
					reason: data.reason?.trim() || "Validação solicitada pela UI.",
					actor: data.actor ?? dependencies.resolveHumanActor?.(req) ?? "human:web-ui",
				});
				if (operation.outcome !== "accepted") {
					sendError(res, operation.reasonCode === "DIRECTION_STALE" ? 409 : 422, operation.reason);
					return true;
				}
				dependencies.broadcast();
				sendJson(res, 200, operation);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}

		if (path === "/api/items/alerts" && method === "GET") {
			const record = dependencies.loadHealthRecord(workspaceRoot);
			const itemAlerts: Record<string, number> = {};
			for (const entry of record.entries) {
				if (entry.status !== "novo") continue;
				const match = entry.id.match(/_([A-Z]+-\d+)_/);
				if (!match) continue;
				const itemId = match[1];
				itemAlerts[itemId] = (itemAlerts[itemId] ?? 0) + 1;
			}
			sendJson(res, 200, { itemAlerts });
			return true;
		}

		if (path === "/api/items" && method === "POST") {
			try {
				const data = await readJson<CreateItemBody>(req);
				if (!data.id || !data.description || !data.stage) {
					sendError(res, 400, "id, description, and stage required");
					return true;
				}
				if (!dependencies.createItemOperation) { sendError(res, 503, "Canonical item creation operation unavailable"); return true; }
				const operation = await dependencies.createItemOperation(workspaceRoot, {
					id: data.id, description: data.description, stage: data.stage,
					actor: data.actor ?? dependencies.resolveHumanActor?.(req) ?? "human:web-ui",
					expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
					reason: data.reason?.trim() || "Item criado pela UI.",
					idempotencyKey: data.idempotencyKey,
				});
				if (operation.outcome !== "accepted") {
					const status = operation.reasonCode === "DIRECTION_STALE" ? 409 : operation.reasonCode === "ITEM_NOT_FOUND" ? 404 : operation.reasonCode === "ITEM_COMPLETED" ? 400 : 422;
					sendError(res, status, operation.reason);
					return true;
				}
				dependencies.broadcast();
				sendJson(res, 200, operation);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}

		const gateDecisionItemId = routeParam(path, "/api/items/:id/gate-decisions");
		if (gateDecisionItemId !== null && method === "POST") {
			try {
				const data = await readJson<GateDecisionBody>(req);
				if (!workflow) {
					sendError(res, 404, "No workflow");
					return true;
				}
				if (
					!data.decision ||
					!["approve", "request-changes", "reject"].includes(data.decision)
				) {
					sendError(res, 400, "decision must be approve, request-changes, or reject");
					return true;
				}
				const reason = data.reason?.trim();
				if (data.decision !== "approve" && !reason) {
					sendError(res, 400, "reason is required for request-changes and reject");
					return true;
				}
				if (!dependencies.decideGateOperation) {
					sendError(res, 503, "Canonical gate decision operation unavailable");
					return true;
				}
				{
					const operation = await dependencies.decideGateOperation(workspaceRoot, {
						itemId: gateDecisionItemId,
						decision: data.decision,
						actor: data.actor ?? dependencies.resolveHumanActor?.(req) ?? "human:web-ui",
						expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
						reason: reason ?? "Aprovação humana registrada pela UI.",
						idempotencyKey: data.idempotencyKey,
					});
					if (operation.outcome !== "accepted") {
						sendError(res, operation.reasonCode === "DIRECTION_STALE" ? 409 : 422, operation.reason);
						return true;
					}
					dependencies.broadcast();
					void dependencies.fireWebhooks(workspaceRoot, "gate.decided", { itemId: gateDecisionItemId, decision: data.decision, reason: reason ?? null });
					sendJson(res, 200, operation);
					return true;
				}
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}

		const activateItemId = routeParam(path, "/api/items/:id/activate");
		if (activateItemId !== null && method === "POST") {
			if (!dependencies.activateWorkOperation) { sendError(res, 501, "Ativação canônica não está disponível."); return true; }
			try {
				const data = await readJson<ActivateWorkBody>(req);
				const operation = await dependencies.activateWorkOperation(workspaceRoot, {
					itemId: activateItemId,
					actor: data.actor ?? dependencies.resolveHumanActor?.(req) ?? "human:web-ui",
					expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
					reason: data.reason?.trim() || "Item priorizado para início do fluxo.",
				});
				if (operation.outcome !== "accepted") { sendError(res, operation.reasonCode === "DIRECTION_STALE" ? 409 : 422, operation.reason); return true; }
				dependencies.broadcast();
				sendJson(res, 200, operation);
			} catch (error) { sendBodyError(error, res); }
			return true;
		}

		const reworkItemId = routeParam(path, "/api/items/:id/request-rework");
		if (reworkItemId !== null && method === "POST") {
			if (!dependencies.requestReworkOperation) { sendError(res, 501, "Retorno canônico para retrabalho não está disponível."); return true; }
			try {
				const data = await readJson<ReworkBody>(req);
				const acceptanceCriteria = (data.acceptanceCriteria ?? []).map((criterion) => ({ id: criterion.id, description: criterion.description?.trim() ?? "" }));
				const operation = await dependencies.requestReworkOperation(workspaceRoot, {
					itemId: reworkItemId,
					actor: data.actor ?? "reviewer",
					expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
					reason: data.reason?.trim() || "A revisão encontrou correções necessárias.",
					acceptanceCriteria,
				});
				if (operation.outcome !== "accepted") { sendError(res, operation.reasonCode === "DIRECTION_STALE" ? 409 : 422, operation.reason); return true; }
				dependencies.broadcast();
				sendJson(res, 200, operation);
			} catch (error) { sendBodyError(error, res); }
			return true;
		}

		const itemId = routeParam(path, "/api/items/:id");
		if (itemId !== null && method === "GET") {
			if (!workflow) {
				sendError(res, 404, "No workflow");
				return true;
			}
			const item = workflow.items.find((candidate) => candidate.id === itemId);
			if (!item) {
				sendError(res, 404, "Item not found");
				return true;
			}
			sendJson(res, 200, item);
			return true;
		}

		if (itemId !== null && method === "PATCH") {
			try {
				const data = await readJson<UpdateItemBody>(req);
				const item = workflow?.items.find((candidate) => candidate.id === itemId);
				if (!workflow || !item) { sendError(res, 404, "Item not found"); return true; }
				const oldStage = item.stage;
				if (data.stage !== undefined && data.stage !== oldStage && (data.description !== undefined || data.tasks !== undefined)) {
					sendError(res, 400, "Stage transition must be submitted separately from item edits");
					return true;
				}
				if (data.stage !== undefined && data.stage !== oldStage) {
					if (!dependencies.requestTransitionOperation) { sendError(res, 503, "Canonical transition operation unavailable"); return true; }
					const operation = await dependencies.requestTransitionOperation(workspaceRoot, {
						itemId,
						targetStageId: data.stage,
						actor: data.actor ?? dependencies.resolveHumanActor?.(req) ?? "human:web-ui",
						expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
						reason: "Transição solicitada pela UI.",
						idempotencyKey: data.idempotencyKey,
					});
					if (operation.outcome !== "accepted") {
						sendError(res, operation.reasonCode === "DIRECTION_STALE" ? 409 : 422, operation.reason);
						return true;
					}
					dependencies.broadcast();
					sendJson(res, 200, operation.nextDirection.item);
					return true;
				}
				if (!dependencies.updateItemOperation) { sendError(res, 503, "Canonical item update operation unavailable"); return true; }
				const operation = await dependencies.updateItemOperation(workspaceRoot, {
					itemId, description: data.description, tasks: data.tasks,
					actor: data.actor ?? dependencies.resolveHumanActor?.(req) ?? "human:web-ui",
					expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
					reason: "Alteração de item solicitada pela UI.", idempotencyKey: data.idempotencyKey,
				});
				if (operation.outcome !== "accepted") { sendError(res, operation.reasonCode === "DIRECTION_STALE" ? 409 : 422, operation.reason); return true; }
				dependencies.broadcast();
				sendJson(res, 200, operation);
			} catch (error) {
				sendBodyError(error, res);
			}
			return true;
		}

		if (itemId !== null && method === "DELETE") {
			if (!dependencies.deleteItemOperation) { sendError(res, 503, "Canonical item deletion operation unavailable"); return true; }
			let data: Pick<UpdateItemBody, "actor" | "expectedRevision" | "idempotencyKey"> = {};
			try { data = await readJson<typeof data>(req); } catch { /* empty body uses current revision */ }
			const operation = await dependencies.deleteItemOperation(workspaceRoot, {
				itemId, actor: data.actor ?? dependencies.resolveHumanActor?.(req) ?? "human:web-ui",
				expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
				reason: "Remoção de item solicitada pela UI.", idempotencyKey: data.idempotencyKey,
			});
			if (operation.outcome !== "accepted") { sendError(res, operation.reasonCode === "DIRECTION_STALE" ? 409 : 422, operation.reason); return true; }
			dependencies.broadcast();
			sendJson(res, 200, operation);
			return true;
		}

		const claimId = routeParam(path, "/api/items/:id/claim");
		if (claimId !== null && method === "POST") {
			if (!dependencies.claimOperation) { sendError(res, 503, "Canonical claim operation unavailable"); return true; }
			try {
				const data = await readJson<ClaimBody>(req);
				const operation = await dependencies.claimOperation(workspaceRoot, {
					itemId: claimId,
					actor: data.actor ?? dependencies.resolveHumanActor?.(req) ?? "human:web-ui",
					executorId: data.executorId ?? "web-ui",
					capability: data.capability ?? "read_code",
					expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
					reason: "Claim solicitado pela UI.",
					idempotencyKey: data.idempotencyKey,
				});
				if (operation.outcome !== "accepted") {
					const status = operation.reasonCode === "DIRECTION_STALE" ? 409 : operation.reasonCode === "ITEM_NOT_FOUND" ? 404 : operation.reasonCode === "ITEM_COMPLETED" ? 400 : 422;
					sendError(res, status, operation.reason);
					return true;
				}
				dependencies.broadcast();
				sendJson(res, 200, operation);
			} catch (error) { sendBodyError(error, res); }
			return true;
		}

		const releaseId = routeParam(path, "/api/items/:id/release");
		if (releaseId !== null && method === "POST") {
			if (!dependencies.releaseClaimOperation) { sendError(res, 503, "Canonical release operation unavailable"); return true; }
			try {
				const data = await readJson<ClaimBody>(req);
				const operation = await dependencies.releaseClaimOperation(workspaceRoot, {
					itemId: releaseId,
					actor: data.actor ?? dependencies.resolveHumanActor?.(req) ?? "human:web-ui",
					expectedRevision: data.expectedRevision ?? resolveAgentDirection(workspaceRoot).revision,
					reason: "Release solicitado pela UI.",
					idempotencyKey: data.idempotencyKey,
				});
				if (operation.outcome !== "accepted") { sendError(res, operation.reasonCode === "DIRECTION_STALE" ? 409 : 422, operation.reason); return true; }
				dependencies.broadcast();
				sendJson(res, 200, operation);
			} catch (error) { sendBodyError(error, res); }
			return true;
		}

		const focusId = routeParam(path, "/api/items/:id/focus");
		if (focusId !== null && method === "POST") {
			if (!workflow) {
				sendError(res, 404, "No workflow");
				return true;
			}
			const item = workflow.items.find((candidate) => candidate.id === focusId);
			if (!item) {
				sendError(res, 404, "Item not found");
				return true;
			}
			const specName = item.spec || focusId;
			dependencies.writeFocusFile(workspaceRoot, specName, item.id);
			dependencies.logEntry(workspaceRoot, "focus_set", `Focus set via UI: ${specName}`, {
				itemId: focusId,
			});
			dependencies.broadcast();
			sendJson(res, 200, { itemId: focusId, spec: specName });
			return true;
		}

		return false;
	};
}
