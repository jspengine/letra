import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { ResolvedFlowRole } from "@letra/types";
import { resolveAgentDirection, resolveDirection } from "../agent-direction/service.js";
import { loadWorkflow } from "../commands/flow-init.js";
import { loadHarnessForWorkflow, resolveActiveFlowFor } from "../flow-definition/resolve.js";
import { getActiveEntries, loadHealthRecord } from "../health-record.js";
import type { Gate, AgentCapability, HarnessManifest } from "../harness/types.js";
import {
	completeAcOperation,
	requestTransitionOperation,
	runValidationOperation,
	claimOperation,
	recordExecutionEvent,
	activityOperation,
	submitEvidenceOperation,
	requestHandoffOperation,
	requestPassageOperation,
	requestReworkOperation,
	runSecurityReviewOperation,
	migrateRunWorkflowOperation,
	createItemOperation,
	linkItemSpecOperation,
} from "../domain-operations/service.js";
import { logEntry } from "../session-log.js";
import {
	createWorkflowDefinition,
	createWorkflowDraft,
	getActiveWorkflowVersion,
	getWorkflowDraft,
	getWorkflowVersion,
	listWorkflowDefinitions,
	listWorkflowVersions,
	publishWorkflowDraft,
	rollbackWorkflowVersion,
	updateWorkflowDraft,
	validateWorkflowContent,
} from "../workflow-versions/service.js";
import { createWorkspaceBoundary, type WorkspaceBoundary } from "../security/workspace-boundary.js";
import { readSpecCatalog } from "../spec-catalog/service.js";
import { getLetraDir, resolveWorkspaceRoot } from "./../workspace/resolver.js";
import { signLocalOperation } from "../identity/signing.js";
import { assertOperationLevel } from "../identity/guard.js";
import { invalidWorkspaceDiagnostic } from "../workspace/integrity.js";

interface ActiveSpecPayload {
	name: string | null;
	path: string | null;
	content: string | null;
}

function jsonText(value: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
	};
}

function safeActiveSpec(
	root: string,
	boundary: WorkspaceBoundary,
	direction = resolveDirection(root),
): ActiveSpecPayload {
	const name = direction.item?.spec ?? null;
	if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
		return { name, path: null, content: null };
	}
	const workspace = resolveWorkspaceRoot(root);
	const candidateRoots = [resolve(workspace.dataDir, "specs"), resolve(workspace.workspaceRoot, "specs"), resolve(getLetraDir(root), "specs")];
	const specsRoot = candidateRoots.find((candidate) => existsSync(resolve(candidate, name, "spec.md")) || existsSync(resolve(candidate, name, "acceptance.md"))) ?? candidateRoots[0]!;
	const specDir = resolve(specsRoot, name);
	if (
		specDir !== specsRoot &&
		!specDir.startsWith(`${specsRoot}\\`) &&
		!specDir.startsWith(`${specsRoot}/`)
	) {
		return { name, path: null, content: null };
	}
	const specPath = join(specDir, "spec.md");
	const acceptancePath = join(specDir, "acceptance.md");
	const selectedPath = existsSync(acceptancePath)
		? (existsSync(specPath) ? specPath : acceptancePath)
		: existsSync(specPath)
			? specPath
			: null;
	return {
		name,
		path: selectedPath ? boundary.assertPath(selectedPath).replace(/\\/g, "/") : null,
		content: selectedPath ? readFileSync(boundary.assertPath(selectedPath), "utf-8") : null,
	};
}

function gateIdFromRef(gateRef: string): string {
	return gateRef.replace(/^.*[\\/]/, "").replace(/\.ya?ml$/, "");
}

function loadHarnessManifest(root: string): HarnessManifest | null {
	return loadHarnessForWorkflow(root, loadWorkflow(root));
}

function collectGates(root: string): Gate[] {
	const harness = loadHarnessManifest(root);
	return harness ? Object.values(harness.gates) : [];
}

function collectRoles(root: string): ResolvedFlowRole[] {
	const resolution = resolveActiveFlowFor(root);
	return [...(resolution.flow?.roles ?? [])];
}

function healthPayload(root: string) {
	const workspace = invalidWorkspaceDiagnostic(root);
	if (workspace) return { reasonCode: workspace.code, workspace };
	const record = loadHealthRecord(root);
	return {
		scannedAt: record.lastScanAt ?? null,
		active: getActiveEntries(record),
	};
}

function resourceText(uri: string, text: string, mimeType = "application/json") {
	return {
		contents: [{ uri, mimeType, text }],
	};
}

export type McpToolProfile = "agent" | "full";

/**
 * Tools que só executam com uma sessão humana vinculada pelo host
 * (requireHumanActor). Sem `resolveBoundHumanActor` elas falham sempre com
 * HUMAN_SESSION_REQUIRED, então expô-las só custa contexto ao agente.
 */
export const HUMAN_BOUND_TOOLS: ReadonlySet<string> = new Set([
	"run_migrate_workflow",
	"workflow_create_definition",
	"workflow_create_draft",
	"workflow_update_draft",
	"workflow_publish",
	"workflow_rollback",
]);

/**
 * Perfil `agent`: superfície mínima de um executor de Run. Cada tool listada
 * aqui custa contexto em toda sessão de clientes que não carregam schemas sob
 * demanda; o perfil `full` continua expondo tudo.
 */
export const AGENT_PROFILE_TOOLS: ReadonlySet<string> = new Set([
	// 1. Orientar-se: direção vigente (já traz gates, operations e warnings),
	//    spec do item e referências verificadas por SHA-256.
	"get_direction",
	"get_active_spec",
	"load_reference",
	// 2. Assumir e executar a Run.
	"claim",
	"execution_event",
	// 3. Provar o trabalho.
	"submit_evidence",
	"validate",
	"complete_ac",
	"security_review",
	// 4. Sair do estágio: avançar (passage), repassar (handoff) ou devolver (rework).
	"request_passage",
	"request_handoff",
	"request_rework",
	// Fora (use --profile full): get_context duplica direction+spec+health;
	// request_transition é coberto por request_passage; create_item/link_item_spec
	// são planejamento; get_activity, get_spec_catalog, get_health, list_gates,
	// list_roles e workflow_* de leitura são observação/administração.
]);

export interface LetraMcpServerOptions {
	resolveBoundHumanActor?: () => string | null;
	profile?: McpToolProfile;
	version?: string;
}

export function exposesTool(name: string, options: LetraMcpServerOptions = {}): boolean {
	if (HUMAN_BOUND_TOOLS.has(name) && !options.resolveBoundHumanActor) return false;
	if ((options.profile ?? "full") === "agent") return AGENT_PROFILE_TOOLS.has(name);
	return true;
}

export function createLetraMcpServer(root: string, options: LetraMcpServerOptions = {}): McpServer {
	const resolution = resolveWorkspaceRoot(root);
	const workspaceDir = resolution.workspaceDir;
	// An invalid link may point at a directory that no longer exists. Build the
	// boundary from the caller's existing location in that case so MCP can
	// return the structured diagnostic instead of throwing from realpathSync.
	const boundary = createWorkspaceBoundary(
		resolution.errorCode === "WORKSPACE_LINK_INVALID" ? resolution.locationPath : workspaceDir,
	);
	const workspaceRoot = resolution.errorCode === "WORKSPACE_LINK_INVALID"
		? resolution.locationPath
		: boundary.root;
	// Preserve the caller's project location while the link is invalid so the
	// operation gateway can emit WORKSPACE_LINK_INVALID before touching any
	// canonical or local projection. A valid link continues to use its
	// canonical workspace root.
	const operationRoot = workspaceRoot;
	// MCP is an agent transport. It never creates a human identity or derives one
	// from local filesystem access; a trusted host must explicitly bind a session.
	const mcpActor = () => {
		const client = server.server.getClientVersion();
		return client?.name ? `mcp:${client.name}` : "mcp:unknown";
	};
	const requireHumanActor = () => {
		const actor = options.resolveBoundHumanActor?.();
		if (!actor?.startsWith("human:") || !existsSync(join(getLetraDir(workspaceRoot), "identity", "local.json"))) throw new Error("HUMAN_SESSION_REQUIRED");
		assertOperationLevel(workspaceRoot, actor, "local");
		return actor;
	};
	const auditedReads = new Set<string>();
	const server = new McpServer({
		name: "letra",
		version: options.version ?? "0.0.0-dev",
	});
	// Filtra a superfície exposta pelo perfil sem tocar em cada registro abaixo:
	// tools fora do perfil simplesmente não são registradas (nem listadas).
	const registerToolUnfiltered = server.registerTool.bind(server) as (...args: unknown[]) => unknown;
	server.registerTool = ((name: string, ...rest: unknown[]) =>
		exposesTool(name, options) ? registerToolUnfiltered(name, ...rest) : undefined) as typeof server.registerTool;
	const readOnlyAnnotations = {
		readOnlyHint: true,
		destructiveHint: false,
		idempotentHint: true,
		openWorldHint: false,
	};
	const verificationAnnotations = {
		readOnlyHint: false,
		destructiveHint: false,
		idempotentHint: false,
		openWorldHint: false,
	};
	const mutationAnnotations = {
		readOnlyHint: false,
		destructiveHint: true,
		idempotentHint: false,
		openWorldHint: false,
	};
	const expectedRevision = z.string().regex(/^sha256:[a-f0-9]{64}$/);
	const reason = z.string().trim().min(1).max(500);
	const auditActor = mcpActor;
	const auditRead = (resource: string, direction = resolveAgentDirection(workspaceRoot)) => {
		if (invalidWorkspaceDiagnostic(workspaceRoot)) return direction;
		const key = `${resource}:${direction.revision}`;
		if (auditedReads.has(key)) return direction;
		const client = auditActor();
		try {
			logEntry(workspaceRoot, "agent_direction_read", `MCP read: ${resource}`, {
				itemId: direction.item?.id,
				acId: direction.pendingAC?.id,
				details: {
					adapter: "mcp",
					by: client,
					resource,
					revision: direction.revision,
					reason: "Consulta de contexto pelo transporte MCP.",
					outcome: "accepted",
				},
			});
			auditedReads.add(key);
		} catch {
			// Direction is a read contract. Audit sink failure degrades the
			// observation path but cannot make context unavailable.
			(direction as unknown as { mode: string }).mode = "degraded";
			(direction as unknown as { warnings: Array<{ code: string; message: string }> }).warnings = [
				...(direction.warnings ?? []),
				{ code: "AUDIT_DEGRADED", message: "Auditoria indisponível; direção retornada sem registro." },
			];
		}
		return direction;
	};
	const blockedRead = () => {
		const workspace = invalidWorkspaceDiagnostic(workspaceRoot);
		return workspace ? { reasonCode: workspace.code, workspace } : null;
	};

	server.registerTool(
		"get_direction",
		{
			description:
				"Retorna a direção vigente e versionada do harness para o workspace atual.",
			inputSchema: {
				runId: z.string().optional(),
				executorId: z.string().optional(),
				itemId: z.string().optional(),
			},
			annotations: readOnlyAnnotations,
		},
		async (args: { runId?: string; executorId?: string; itemId?: string }) => {
			const blocked = blockedRead();
			if (blocked) return jsonText(blocked);
			try {
				return jsonText(auditRead("direction", resolveDirection(workspaceRoot, args)));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return jsonText({ reasonCode: message.split(":")[0], message });
			}
		},
	);
	server.registerTool(
		"get_active_spec",
		{
			description: "Retorna a spec ativa e seus critérios de aceitação.",
			inputSchema: { runId: z.string().optional(), executorId: z.string().optional(), itemId: z.string().optional() },
			annotations: readOnlyAnnotations,
		},
		async (args: { runId?: string; executorId?: string; itemId?: string }) => {
			const blocked = blockedRead();
			if (blocked) return jsonText(blocked);
			try {
				const direction = resolveDirection(workspaceRoot, args);
				auditRead("active-spec", direction);
				return jsonText(safeActiveSpec(workspaceRoot, boundary, direction));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return jsonText({ reasonCode: message.split(":")[0], message });
			}
		},
	);
	server.registerTool(
		"get_health",
		{
			description: "Retorna alertas operacionais ativos do workspace.",
			annotations: readOnlyAnnotations,
		},
		async () => {
			const blocked = blockedRead();
			if (blocked) return jsonText(blocked);
			auditRead("health");
			return jsonText(healthPayload(workspaceRoot));
		},
	);
	server.registerTool(
		"validate",
		{
			description: "Valida o workspace pela implementação canônica e registra o resultado.",
			inputSchema: {
				itemId: z.string().regex(/^ITEM-\d+$/i).optional(),
				runId: z.string().trim().min(1).optional(),
				executorId: z.string().trim().min(1).optional(),
				expectedRevision,
				reason,
				idempotencyKey: z.string().trim().min(1).max(200).optional(),
			},
			annotations: verificationAnnotations,
		},
		async (input) =>
			jsonText(
				await runValidationOperation(operationRoot, {
					...input,
					actor: mcpActor(),
				}),
			),
	);
	server.registerTool(
		"complete_ac",
		{
			description: "Conclui o AC vigente após validar revisão e evidência de regressão.",
			inputSchema: {
				itemId: z.string().regex(/^ITEM-\d+$/i),
				acId: z.string().regex(/^AC\d+(?:\.\d+)*$/i),
				executorId: z.string().trim().min(1).optional(),
				runId: z.string().trim().min(1).optional(),
				expectedRevision,
				evidence: z.array(z.string().trim().min(1).max(500)).max(20),
				reason,
				idempotencyKey: z.string().trim().min(1).max(200).optional(),
			},
			annotations: mutationAnnotations,
		},
		async (input) =>
			jsonText(
				completeAcOperation(operationRoot, {
					...input,
					actor: mcpActor(),
				}),
			),
	);
	server.registerTool(
		"request_transition",
		{
			description: "Solicita transição do item vigente sem contornar ACs, papéis ou gates.",
			inputSchema: {
				itemId: z.string().regex(/^ITEM-\d+$/i),
				targetStageId: z.string().regex(/^[a-zA-Z0-9._-]+$/),
				expectedRevision,
				reason,
				idempotencyKey: z.string().trim().min(1).max(200).optional(),
			},
			annotations: mutationAnnotations,
		},
		async (input) =>
			jsonText(
				await requestTransitionOperation(operationRoot, {
					...input,
					actor: mcpActor(),
				}),
			),
	);
	server.registerTool("get_context", { description: "Retorna contexto operacional canônico completo.", annotations: readOnlyAnnotations }, async () => {
		const blocked = blockedRead();
		if (blocked) return jsonText(blocked);
		const direction = auditRead("context");
		return jsonText({
			direction,
			spec: safeActiveSpec(workspaceRoot, boundary),
			health: healthPayload(workspaceRoot),
			workflow: loadWorkflow(workspaceRoot),
		});
	});
	server.registerTool("get_activity", { description: "Retorna atividade operacional vigente.", inputSchema: { itemId: z.string().optional() }, annotations: readOnlyAnnotations }, async ({ itemId }) => {
		const blocked = blockedRead();
		if (blocked) return jsonText(blocked);
		return jsonText(activityOperation(workspaceRoot, itemId));
	});
	server.registerTool("get_spec_catalog", { description: "Retorna a matriz canônica de specs, disposições e referências.", annotations: readOnlyAnnotations }, async () => {
		const blocked = blockedRead();
		if (blocked) return jsonText(blocked);
		auditRead("spec-catalog");
		return jsonText(readSpecCatalog(workspaceRoot));
	});
	server.registerTool("load_reference", { description: "Carrega uma referência da direção e verifica seu hash SHA-256 atual.", inputSchema: { id: z.string(), runId: z.string().optional(), executorId: z.string().optional(), itemId: z.string().optional(), expectedSha256: z.string().regex(/^[a-f0-9]{64}$/).optional() }, annotations: readOnlyAnnotations }, async ({ id, runId, executorId, itemId, expectedSha256 }) => {
		const blocked = blockedRead();
		if (blocked) return jsonText(blocked);
		let direction: ReturnType<typeof resolveDirection>;
		try { direction = resolveDirection(workspaceRoot, { runId, executorId, itemId }); }
		catch (error) { const message = error instanceof Error ? error.message : String(error); return jsonText({ reasonCode: message.split(":")[0], message }); }
		const reference = direction.references?.find((entry) => entry.id === id);
		if (!reference) return jsonText({ reasonCode: "REFERENCE_NOT_FOUND", id });
		const path = boundary.assertPath(join(getLetraDir(workspaceRoot), reference.path));
		if (!reference.available || !existsSync(path)) return jsonText({ status: "unavailable", reasonCode: "REFERENCE_UNAVAILABLE", id, path: reference.path });
		const content = readFileSync(path, "utf8");
		const sha256 = createHash("sha256").update(content).digest("hex");
		const expected = expectedSha256 ?? reference.sha256;
		const verified = expected === sha256;
		return jsonText({ id, path: reference.path, status: verified ? "current" : "stale", reasonCode: verified ? null : "REFERENCE_STALE", expectedSha256: expected, sha256, verified, content });
	});
	server.registerTool("claim", { description: "Solicita claim exclusivo.", inputSchema: { itemId: z.string(), executorId: z.string(), capability: z.string(), expectedRevision, reason, ttlMinutes: z.number().optional(), idempotencyKey: z.string().trim().min(1).max(200).optional() }, annotations: mutationAnnotations }, async (input) => jsonText(await claimOperation(operationRoot, { ...input, actor: mcpActor() })));
	server.registerTool("create_item", { description: "Cria item no primeiro estágio usando a operação canônica. O ID incremental é padrão; itemId permite escolher ITEM-N.", inputSchema: { description: z.string().trim().min(1).max(4000), itemId: z.string().trim().optional(), spec: z.string().trim().optional(), runId: z.string(), executorId: z.string(), expectedRevision, reason, idempotencyKey: z.string().trim().min(1).max(200).optional() }, annotations: mutationAnnotations }, async ({ description, itemId, spec, runId, executorId, expectedRevision: revision, reason: why, idempotencyKey }) => jsonText(await createItemOperation(operationRoot, { id: itemId, description, spec, runId, executorId, expectedRevision: revision, reason: why, idempotencyKey, actor: mcpActor() })));
	server.registerTool("link_item_spec", { description: "Vincula uma spec existente e seus ACs ao item pela operação canônica revision-aware.", inputSchema: { itemId: z.string(), specId: z.string().trim().min(1), runId: z.string(), executorId: z.string(), expectedRevision, reason, idempotencyKey: z.string().trim().min(1).max(200).optional() }, annotations: mutationAnnotations }, async (input) => jsonText(await linkItemSpecOperation(operationRoot, { ...input, actor: mcpActor() })));
	server.registerTool("execution_event", { description: "Registra started, heartbeat, succeeded ou failed.", inputSchema: { itemId: z.string(), status: z.enum(["started", "heartbeat", "succeeded", "failed"]), executorId: z.string(), expectedRevision, reason, message: z.string().optional(), recovery: z.enum(["retry", "release", "handoff", "human"]).optional(), errorCode: z.string().optional(), idempotencyKey: z.string().trim().min(1).max(200).optional() }, annotations: mutationAnnotations }, async (input) => jsonText(await recordExecutionEvent(operationRoot, { ...input, actor: mcpActor() })));
	server.registerTool("submit_evidence", { description: "Registra evidência estruturada confinada.", inputSchema: { itemId: z.string(), executorId: z.string(), expectedRevision, reason, evidence: z.array(z.object({ kind: z.enum(["diff", "file", "command", "test", "artifact"]), value: z.string(), source: z.string(), observedAt: z.string().optional(), sha256: z.string().optional(), exitCode: z.number().optional() })), idempotencyKey: z.string().trim().min(1).max(200).optional() }, annotations: mutationAnnotations }, async (input) => jsonText(await submitEvidenceOperation(operationRoot, { ...input, actor: mcpActor() })));
	server.registerTool("security_review", { description: "Executa a revisão de Security escopada ao item, usando baseline e política do harness.", inputSchema: { itemId: z.string(), executorId: z.string(), expectedRevision, reason, idempotencyKey: z.string().trim().min(1).max(200).optional() }, annotations: mutationAnnotations }, async (input) => jsonText(await runSecurityReviewOperation(operationRoot, { ...input, actor: mcpActor() })));
	server.registerTool("request_handoff", { description: "Solicita handoff atômico.", inputSchema: { itemId: z.string(), to: z.string(), executorId: z.string(), summary: z.string(), evidence: z.array(z.string()), expectedRevision, reason, idempotencyKey: z.string().trim().min(1).max(200).optional() }, annotations: mutationAnnotations }, async (input) => jsonText(await requestHandoffOperation(operationRoot, { ...input, actor: mcpActor() })));
	server.registerTool("request_passage", { description: "Valida e comita transição, handoff e Run pela operação canônica.", inputSchema: { itemId: z.string(), targetStageId: z.string(), to: z.string(), executorId: z.string(), runId: z.string().trim().min(1).optional(), summary: z.string(), evidence: z.array(z.string()), expectedRevision, reason, idempotencyKey: z.string().trim().min(1).max(200).optional() }, annotations: mutationAnnotations }, async (input) => jsonText(await requestPassageOperation(operationRoot, { ...input, actor: mcpActor() })));
	server.registerTool("request_rework", { description: "Solicita retrabalho conforme a configuração declarativa do estágio.", inputSchema: { itemId: z.string(), expectedRevision, reason, acceptanceCriteria: z.array(z.object({ id: z.string().optional(), description: z.string().min(1) })).default([]) }, annotations: mutationAnnotations }, async (input) => jsonText(await requestReworkOperation(operationRoot, { ...input, actor: mcpActor() })));

	server.registerResource(
		"direction",
		"letra://direction",
		{ title: "Direção vigente do harness", mimeType: "application/json" },
		async () => {
			const blocked = blockedRead();
			if (blocked) return resourceText("letra://direction", JSON.stringify(blocked, null, 2), "application/json");
			return resourceText("letra://direction", JSON.stringify(auditRead("direction"), null, 2), "application/json");
		},
	);
	server.registerResource(
		"active-spec",
		"letra://spec/active",
		{ title: "Spec ativa", mimeType: "text/markdown" },
		async () => {
			const blocked = blockedRead();
			if (blocked) return resourceText("letra://spec/active", JSON.stringify(blocked, null, 2), "application/json");
			auditRead("active-spec");
			return resourceText("letra://spec/active", safeActiveSpec(workspaceRoot, boundary).content ?? "", "text/markdown");
		},
	);
	server.registerResource(
		"spec-catalog",
		"letra://spec-catalog",
		{ title: "Catálogo canônico de specs", mimeType: "application/json" },
		async () => {
			const blocked = blockedRead();
			if (blocked) return resourceText("letra://spec-catalog", JSON.stringify(blocked, null, 2), "application/json");
			auditRead("spec-catalog");
			return resourceText("letra://spec-catalog", JSON.stringify(readSpecCatalog(workspaceRoot), null, 2), "application/json");
		},
	);
	server.registerResource(
		"constitution",
		"letra://constitution",
		{ title: "Constituição do workspace", mimeType: "text/markdown" },
		async () => {
			const blocked = blockedRead();
			if (blocked) return resourceText("letra://constitution", JSON.stringify(blocked, null, 2), "application/json");
			auditRead("constitution");
			const path = boundary.assertPath(join(getLetraDir(workspaceRoot), "constitution.md"));
			const content = existsSync(path) ? readFileSync(path, "utf-8") : "";

			// Log constitution_read
			logEntry(workspaceRoot, "constitution_read", "Constitution read via MCP", {
				details: {
					adapter: "mcp",
					by: "mcp:constitution-resource",
					available: existsSync(path),
					version: content.match(/\*\*Version:\*\*\s*(.+)/)?.[1]?.trim() ?? null,
				},
			});

			return resourceText("letra://constitution", content, "text/markdown");
		},
	);
	server.registerResource(
		"health",
		"letra://health",
		{ title: "Saúde operacional", mimeType: "application/json" },
		async () => {
			const blocked = blockedRead();
			if (blocked) return resourceText("letra://health", JSON.stringify(blocked, null, 2));
			auditRead("health");
			return resourceText("letra://health", JSON.stringify(healthPayload(workspaceRoot), null, 2));
		},
	);

	const auditHarnessRead = (resource: string) => {
		if (blockedRead()) return false;
		const direction = resolveAgentDirection(workspaceRoot);
		const key = `harness:${resource}:${direction.revision}`;
		if (auditedReads.has(key)) return;
		auditedReads.add(key);
		const client = auditActor();
		logEntry(workspaceRoot, "agent_harness_read", `MCP harness read: ${resource}`, {
			itemId: direction.item?.id,
			acId: direction.pendingAC?.id,
			details: {
				adapter: "mcp",
				by: client,
				resource,
				revision: direction.revision,
				outcome: "accepted",
			},
		});
	};

	server.registerResource(
		"harness-templates",
		"letra://harness/templates",
		{ title: "Templates disponíveis no harness", mimeType: "application/json" },
		async () => {
			const blocked = blockedRead();
			if (blocked) return resourceText("letra://harness/templates", JSON.stringify(blocked, null, 2));
			auditHarnessRead("templates");
			const workflow = loadWorkflow(workspaceRoot);
			const harness = loadHarnessForWorkflow(workspaceRoot, workflow);
			const templateIds = harness ? Object.keys(harness.flows).sort() : [];
			return resourceText("letra://harness/templates", JSON.stringify(templateIds, null, 2));
		},
	);
	server.resource(
		"harness-template",
		new ResourceTemplate("letra://harness/templates/{flowId}", { list: undefined }),
		async (uri, variables) => {
			const blocked = blockedRead();
			if (blocked) return resourceText(uri.href, JSON.stringify(blocked, null, 2));
			const flowId = variables.flowId as string;
			auditHarnessRead(`templates/${flowId}`);
			const workflow = loadWorkflow(workspaceRoot);
			const harness = loadHarnessForWorkflow(workspaceRoot, workflow);
			if (!harness) {
				return resourceText(uri.href, JSON.stringify({ error: "Harness not available" }));
			}
			const template = harness.flows[flowId];
			if (!template) {
				return resourceText(
					uri.href,
					JSON.stringify({ error: `Template "${flowId}" not found` }),
				);
			}
			const resolvedStages = template.stages.map((stage) => {
				const gateId = stage.gate ? gateIdFromRef(stage.gate) : null;
				return {
					id: stage.id,
					name: stage.name,
					order: stage.order,
					zone: stage.zone,
					description: stage.description,
					gate: gateId && harness.gates[gateId] ? harness.gates[gateId] : null,
					roles: stage.agents.map((roleId) => harness.roles[roleId]).filter(Boolean),
					phases: stage.phases,
					activity: stage.activity,
				};
			});
			const policyId = template.defaultPolicy
				? template.defaultPolicy.replace(/^.*[\\/]/, "").replace(/\.json$/, "")
				: null;
			return resourceText(
				uri.href,
				JSON.stringify(
					{
						id: template.id,
						version: template.version,
						name: template.name,
						description: template.description,
						defaultPolicy: template.defaultPolicy,
						stages: resolvedStages,
						gates: Object.values(harness.gates),
						roles: Object.values(harness.roles),
						policy:
							policyId && harness.policies[policyId]
								? harness.policies[policyId]
								: null,
					},
					null,
					2,
				),
			);
		},
	);
	server.registerResource(
		"harness-gates",
		"letra://harness/gates",
		{ title: "Gates do harness", mimeType: "application/json" },
		async () => {
			const blocked = blockedRead();
			if (blocked) return resourceText("letra://harness/gates", JSON.stringify(blocked, null, 2));
			auditHarnessRead("gates");
			return resourceText(
				"letra://harness/gates",
				JSON.stringify(collectGates(workspaceRoot), null, 2),
			);
		},
	);
	server.registerResource(
		"harness-roles",
		"letra://harness/roles",
		{ title: "Roles do harness", mimeType: "application/json" },
		async () => {
			const blocked = blockedRead();
			if (blocked) return resourceText("letra://harness/roles", JSON.stringify(blocked, null, 2));
			auditHarnessRead("roles");
			return resourceText(
				"letra://harness/roles",
				JSON.stringify(collectRoles(workspaceRoot), null, 2),
			);
		},
	);

	server.registerTool(
		"list_gates",
		{
			description: "Lista todos os gates do template ativo do harness.",
			annotations: readOnlyAnnotations,
		},
		async () => {
			const blocked = blockedRead();
			if (blocked) return jsonText(blocked);
			auditHarnessRead("gates");
			return jsonText(collectGates(workspaceRoot));
		},
	);
	server.registerTool(
			"list_roles",
			{
				description: "Lista todos os roles do template ativo do harness.",
				annotations: readOnlyAnnotations,
			},
			async () => {
				const blocked = blockedRead();
				if (blocked) return jsonText(blocked);
				auditHarnessRead("roles");
				return jsonText(collectRoles(workspaceRoot));
			},
		);

		// ─── Workflow Versioning Tools ─────────────────────────────────────────────
		server.registerTool(
			"workflow_list_definitions",
			{ description: "Lista todas as definições de workflow do workspace.", annotations: readOnlyAnnotations },
			async () => jsonText(listWorkflowDefinitions(workspaceRoot)),
		);

		server.registerTool(
			"workflow_list_versions",
			{ description: "Lista todas as versões publicadas de um workflow.", inputSchema: { workflowId: z.string() }, annotations: readOnlyAnnotations },
			async ({ workflowId }) => jsonText(listWorkflowVersions(workspaceRoot, workflowId)),
		);

		server.registerTool(
			"workflow_get_version",
			{ description: "Obtém uma versão específica de um workflow.", inputSchema: { workflowId: z.string(), versionNumber: z.number() }, annotations: readOnlyAnnotations },
			async ({ workflowId, versionNumber }) => jsonText(getWorkflowVersion(workspaceRoot, workflowId, versionNumber)),
		);

		server.registerTool(
			"workflow_get_active",
			{ description: "Obtém a versão ativa de um workflow.", inputSchema: { workflowId: z.string() }, annotations: readOnlyAnnotations },
			async ({ workflowId }) => jsonText(getActiveWorkflowVersion(workspaceRoot, workflowId)),
		);

		server.registerTool(
			"workflow_get_draft",
			{ description: "Obtém o rascunho atual de um workflow.", inputSchema: { workflowId: z.string() }, annotations: readOnlyAnnotations },
			async ({ workflowId }) => jsonText(getWorkflowDraft(workspaceRoot, workflowId)),
		);

		server.registerTool(
			"run_migrate_workflow",
			{
				description: "Migra uma Run para uma versão publicada de workflow com autorização humana assinada.",
				inputSchema: { runId: z.string(), toWorkflowVersionId: z.string(), toStageId: z.string(), expectedRunRevision: z.number().int().positive(), expectedRevision, reason },
				annotations: mutationAnnotations,
			},
			async (input) => {
				const actor = requireHumanActor();
				const details = { runId: input.runId, toWorkflowVersionId: input.toWorkflowVersionId, toStageId: input.toStageId, expectedRunRevision: input.expectedRunRevision, expectedDirectionRevision: input.expectedRevision, reason: input.reason };
				const proof = signLocalOperation(workspaceRoot, actor, "run.workflow.migrate", details);
				return jsonText(migrateRunWorkflowOperation(operationRoot, { ...input, actor, proof }));
			},
		);

		server.registerTool(
					"workflow_create_definition",
					{
						description: "Cria uma nova definição de workflow.",
						inputSchema: { name: z.string(), description: z.string().optional() },
						annotations: mutationAnnotations,
					},
					async (input) => jsonText(createWorkflowDefinition(workspaceRoot, { ...input, actor: requireHumanActor() })),
				);

				server.registerTool(
					"workflow_create_draft",
					{
						description: "Cria um rascunho para edição de um workflow.",
						inputSchema: { workflowId: z.string(), basedOnVersionNumber: z.number().optional() },
						annotations: mutationAnnotations,
					},
					async ({ workflowId, basedOnVersionNumber }) => jsonText(createWorkflowDraft(workspaceRoot, workflowId, requireHumanActor(), basedOnVersionNumber)),
				);

				server.registerTool(
					"workflow_update_draft",
				{
					description: "Atualiza o conteúdo de um rascunho.",
					inputSchema: {
						workflowId: z.string(),
						expectedRevision: z.number(),
						content: z.record(z.unknown()),
						changeSummary: z.string().optional(),
					},
					annotations: mutationAnnotations,
				},
				async (input) => jsonText(updateWorkflowDraft(workspaceRoot, input.workflowId, { actor: requireHumanActor(), expectedRevision: input.expectedRevision, content: input.content as Parameters<typeof updateWorkflowDraft>[2]["content"], changeSummary: input.changeSummary })),
			);

			server.registerTool(
				"workflow_validate_draft",
				{ description: "Valida o conteúdo do rascunho atual.", inputSchema: { workflowId: z.string() }, annotations: verificationAnnotations },
				async ({ workflowId }) => jsonText(validateWorkflowContent(getWorkflowDraft(workspaceRoot, workflowId).content)),
			);

			server.registerTool(
				"workflow_publish",
				{
					description: "Publica o rascunho como nova versão.",
					inputSchema: { workflowId: z.string(), expectedRevision: z.number(), reason },
					annotations: mutationAnnotations,
				},
				async (input) => jsonText(publishWorkflowDraft(workspaceRoot, input.workflowId, { expectedRevision: input.expectedRevision, actor: requireHumanActor(), reason: input.reason })),
			);

			server.registerTool(
						"workflow_rollback",
						{
							description: "Faz rollback para uma versão anterior (publica nova versão derivada).",
							inputSchema: { workflowId: z.string(), versionNumber: z.number(), reason },
							annotations: mutationAnnotations,
						},
						async (input) => { const actor = requireHumanActor(); const proof = signLocalOperation(workspaceRoot, actor, "workflow.rollback", { workflowId: input.workflowId, versionNumber: input.versionNumber, reason: input.reason }); return jsonText(rollbackWorkflowVersion(workspaceRoot, input.workflowId, { versionNumber: input.versionNumber, actor, reason: input.reason, proof })); },
					);

					return server;
}

export async function startLetraMcpServer(root: string, options: Pick<LetraMcpServerOptions, "profile" | "version"> = {}): Promise<void> {
	const server = createLetraMcpServer(root, options);
	await server.connect(new StdioServerTransport());
}
