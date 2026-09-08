import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { ResolvedFlowRole } from "@letra/types";
import { resolveAgentDirection } from "../agent-direction/service.js";
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
} from "../domain-operations/service.js";
import { logEntry } from "../session-log.js";
import { createWorkspaceBoundary, type WorkspaceBoundary } from "../security/workspace-boundary.js";
import { getLetraDir, resolveWorkspaceRoot } from "./../workspace/resolver.js";

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

function safeActiveSpec(root: string, boundary: WorkspaceBoundary): ActiveSpecPayload {
	const direction = resolveAgentDirection(root);
	const name = direction.item?.spec ?? null;
	if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
		return { name, path: null, content: null };
	}
	const specsRoot = resolve(root, ".letra", "specs");
	const specDir = resolve(specsRoot, name);
	if (
		specDir !== specsRoot &&
		!specDir.startsWith(`${specsRoot}\\`) &&
		!specDir.startsWith(`${specsRoot}/`)
	) {
		return { name, path: null, content: null };
	}
	const acceptancePath = join(specDir, "acceptance.md");
	const specPath = join(specDir, "spec.md");
	const selectedPath = existsSync(acceptancePath)
		? acceptancePath
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

export function createLetraMcpServer(root: string): McpServer {
	const resolution = resolveWorkspaceRoot(root);
	const workspaceDir = resolution.workspaceDir;
	const boundary = createWorkspaceBoundary(workspaceDir);
	const workspaceRoot = boundary.root;
	const auditedReads = new Set<string>();
	const server = new McpServer({
		name: "letra",
		version: "0.5.3",
	});
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
	const clientIdentity = () => {
		const client = server.server.getClientVersion();
		return {
			actor: client?.name ? `mcp:${client.name}` : "mcp:unknown",
			clientVersion: client?.version ?? null,
		};
	};
	const auditRead = (resource: string, direction = resolveAgentDirection(workspaceRoot)) => {
		const key = `${resource}:${direction.revision}`;
		if (auditedReads.has(key)) return direction;
		auditedReads.add(key);
		const client = clientIdentity();
		logEntry(workspaceRoot, "agent_direction_read", `MCP read: ${resource}`, {
			itemId: direction.item?.id,
			acId: direction.pendingAC?.id,
			details: {
				adapter: "codex",
				by: client.actor,
				clientVersion: client.clientVersion,
				resource,
				revision: direction.revision,
				reason: "Consulta de contexto pelo transporte MCP.",
				outcome: "accepted",
			},
		});
		return direction;
	};

	server.registerTool(
		"get_direction",
		{
			description:
				"Retorna a direção vigente e versionada do harness para o workspace atual.",
			annotations: readOnlyAnnotations,
		},
		async () => jsonText(auditRead("direction")),
	);
	server.registerTool(
		"get_active_spec",
		{
			description: "Retorna a spec ativa e seus critérios de aceitação.",
			annotations: readOnlyAnnotations,
		},
		async () => {
			auditRead("active-spec");
			return jsonText(safeActiveSpec(workspaceRoot, boundary));
		},
	);
	server.registerTool(
		"get_health",
		{
			description: "Retorna alertas operacionais ativos do workspace.",
			annotations: readOnlyAnnotations,
		},
		async () => {
			auditRead("health");
			return jsonText(healthPayload(workspaceRoot));
		},
	);
	server.registerTool(
		"validate",
		{
			description: "Valida o workspace pela implementação canônica e registra o resultado.",
			inputSchema: {
				expectedRevision,
				reason,
			},
			annotations: verificationAnnotations,
		},
		async (input) =>
			jsonText(
				await runValidationOperation(workspaceRoot, {
					...input,
					actor: clientIdentity().actor,
				}),
			),
	);
	server.registerTool(
		"complete_ac",
		{
			description: "Conclui o AC vigente após validar revisão e evidência de regressão.",
			inputSchema: {
				acId: z.string().regex(/^AC\d+(?:\.\d+)*$/i),
				expectedRevision,
				evidence: z.array(z.string().trim().min(1).max(500)).max(20),
				reason,
			},
			annotations: mutationAnnotations,
		},
		async (input) =>
			jsonText(
				completeAcOperation(workspaceRoot, {
					...input,
					actor: clientIdentity().actor,
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
			},
			annotations: mutationAnnotations,
		},
		async (input) =>
			jsonText(
				await requestTransitionOperation(workspaceRoot, {
					...input,
					actor: clientIdentity().actor,
				}),
			),
	);
	server.registerTool("get_context", { description: "Retorna contexto operacional canônico.", annotations: readOnlyAnnotations }, async () => jsonText(auditRead("context")));
	server.registerTool("get_activity", { description: "Retorna atividade operacional vigente.", inputSchema: { itemId: z.string().optional() }, annotations: readOnlyAnnotations }, async ({ itemId }) => jsonText(activityOperation(workspaceRoot, itemId)));
	server.registerTool("claim", { description: "Solicita claim exclusivo.", inputSchema: { itemId: z.string(), executorId: z.string(), capability: z.string(), expectedRevision, reason, ttlMinutes: z.number().optional() }, annotations: mutationAnnotations }, async (input) => jsonText(await claimOperation(workspaceRoot, { ...input, actor: clientIdentity().actor })));
	server.registerTool("execution_event", { description: "Registra started, heartbeat, succeeded ou failed.", inputSchema: { itemId: z.string(), status: z.enum(["started", "heartbeat", "succeeded", "failed"]), executorId: z.string(), expectedRevision, reason, message: z.string().optional(), recovery: z.enum(["retry", "release", "handoff", "human"]).optional(), errorCode: z.string().optional() }, annotations: mutationAnnotations }, async (input) => jsonText(await recordExecutionEvent(workspaceRoot, { ...input, actor: clientIdentity().actor })));
	server.registerTool("submit_evidence", { description: "Registra evidência estruturada confinada.", inputSchema: { itemId: z.string(), executorId: z.string(), expectedRevision, reason, evidence: z.array(z.object({ kind: z.enum(["diff", "file", "command", "test", "artifact"]), value: z.string(), source: z.string(), observedAt: z.string().optional(), sha256: z.string().optional(), exitCode: z.number().optional() })) }, annotations: mutationAnnotations }, async (input) => jsonText(await submitEvidenceOperation(workspaceRoot, { ...input, actor: clientIdentity().actor })));
	server.registerTool("request_handoff", { description: "Solicita handoff atômico.", inputSchema: { itemId: z.string(), to: z.string(), executorId: z.string(), summary: z.string(), evidence: z.array(z.string()), expectedRevision, reason }, annotations: mutationAnnotations }, async (input) => jsonText(await requestHandoffOperation(workspaceRoot, { ...input, actor: clientIdentity().actor })));

	server.registerResource(
		"direction",
		"letra://direction",
		{ title: "Direção vigente do harness", mimeType: "application/json" },
		async () =>
			resourceText("letra://direction", JSON.stringify(auditRead("direction"), null, 2)),
	);
	server.registerResource(
		"active-spec",
		"letra://spec/active",
		{ title: "Spec ativa", mimeType: "text/markdown" },
		async () =>
			resourceText(
				"letra://spec/active",
				(auditRead("active-spec"), safeActiveSpec(workspaceRoot, boundary).content ?? ""),
				"text/markdown",
			),
	);
	server.registerResource(
		"constitution",
		"letra://constitution",
		{ title: "Constituição do workspace", mimeType: "text/markdown" },
		async () => {
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
		async () =>
			resourceText(
				"letra://health",
				JSON.stringify((auditRead("health"), healthPayload(workspaceRoot)), null, 2),
			),
	);

	const auditHarnessRead = (resource: string) => {
		const direction = resolveAgentDirection(workspaceRoot);
		const key = `harness:${resource}:${direction.revision}`;
		if (auditedReads.has(key)) return;
		auditedReads.add(key);
		const client = clientIdentity();
		logEntry(workspaceRoot, "agent_harness_read", `MCP harness read: ${resource}`, {
			itemId: direction.item?.id,
			acId: direction.pendingAC?.id,
			details: {
				adapter: "codex",
				by: client.actor,
				clientVersion: client.clientVersion,
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
			auditHarnessRead("roles");
			return jsonText(collectRoles(workspaceRoot));
		},
	);

	return server;
}

export async function startLetraMcpServer(root: string): Promise<void> {
	const server = createLetraMcpServer(root);
	await server.connect(new StdioServerTransport());
}
