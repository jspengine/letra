import type { AgentIdentity, AgentRegistry, AgentRuntimeBinding, Workflow } from "@letra/types";
import type { AgenticExecutor } from "../executor/executor.js";
import type { HarnessManifest } from "../harness/types.js";

const ACTIVE_ACTIVITY_STATUSES = new Set(["started", "heartbeat"]);

/**
 * A persisted claim is only an active presence while its lease and liveness
 * signal are both current. Historical activity markers must never make an
 * identity appear busy after release, failure, or a dispatcher restart.
 */
export function hasActiveClaim(item: Pick<Workflow["items"][number], "claimedBy" | "claimExpiresAt" | "activityStatus" | "lastHeartbeatAt">, now = Date.now()): boolean {
	if (!item.claimedBy || !item.claimExpiresAt || !item.lastHeartbeatAt) return false;
	const expiresAt = Date.parse(item.claimExpiresAt);
	const heartbeatAt = Date.parse(item.lastHeartbeatAt);
	if (!Number.isFinite(expiresAt) || !Number.isFinite(heartbeatAt)) return false;
	if (expiresAt <= now || heartbeatAt > now) return false;
	return ACTIVE_ACTIVITY_STATUSES.has(item.activityStatus ?? "");
}

export type RuntimeBindingReasonCode =
	| "NO_COMPATIBLE_BINDING"
	| "ORPHAN_REFERENCE"
	| "IDENTITY_NOT_FOUND"
	| "ROLE_NOT_ALLOWED"
	| "STAGE_NOT_ALLOWED"
	| "EXECUTOR_OFFLINE"
	| "CAPABILITY_INSUFFICIENT";

export interface RuntimeBindingResolution {
	ok: boolean;
	binding?: AgentRuntimeBinding;
	identity?: AgentIdentity;
	executor?: AgenticExecutor;
	reasonCode?: RuntimeBindingReasonCode;
	reason?: string;
}

function stable(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

/** The harness registry uses broad executor families while roles name actions. */
export function executorSupports(executor: Pick<AgenticExecutor, "capabilities">, capability: string): boolean {
	if (executor.capabilities.includes(capability)) return true;
	const family: Record<string, string> = {
		read_code: "code", write_code: "code", run_tests: "code", generate_doc: "design",
		write_spec: "design", review_code: "review", suggest_changes: "review",
		security_scan: "security", dependency_audit: "security",
	};
	return family[capability] !== undefined && executor.capabilities.includes(family[capability]);
}

function identityRoles(identity: AgentIdentity): string[] {
	return identity.roleIds?.length ? identity.roleIds : [identity.role];
}

function candidateExecutorIds(manifest: HarnessManifest, stageId: string): string[] {
	const preferred = manifest.executors?.stageExecutorPreferences[stageId] ?? [];
	const known = manifest.executors?.executors.map((executor) => executor.id) ?? [];
	return [...new Set([...preferred, ...known])];
}

/**
 * Produces deterministic defaults for migrated registries. Persisted bindings
 * are still authoritative, but this makes an old agents.json safe to load.
 */
export function defaultRuntimeBindings(
	registry: Pick<AgentRegistry, "agents">,
	workflow: Workflow,
	manifest: HarnessManifest | null,
): AgentRuntimeBinding[] {
	if (!manifest) return [];
	const flow = manifest.flows[workflow.template ?? "flow-main"];
	if (!flow) return [];
	const bindings: AgentRuntimeBinding[] = [];
	for (const identity of registry.agents) {
		for (const roleId of identityRoles(identity)) {
			const role = manifest.roles[roleId];
			if (!role) continue;
			const stageIds = flow.stages
				.filter((stage) => stage.agents.includes(roleId) && identity.stageBindings.includes(stage.id))
				.map((stage) => stage.id);
			if (stageIds.length === 0) continue;
			const executorId = stageIds
				.flatMap((stageId) => candidateExecutorIds(manifest, stageId))
				.find(Boolean);
			if (!executorId) continue;
			bindings.push({
				version: "1",
				id: `${identity.id}:${roleId}:${executorId}`,
				identityId: identity.id,
				roleId,
				executorId,
				capabilities: [...role.capabilities],
				stageIds,
				availability: "online-required",
				harnessVersion: workflow.harnessVersion ?? manifest.version,
				promptTemplate: role.promptTemplate,
			});
		}
	}
	return bindings.sort((left, right) => left.id.localeCompare(right.id));
}

export function normalizeRuntimeBindings(
	registry: AgentRegistry,
	workflow: Workflow,
	manifest: HarnessManifest | null,
): AgentRuntimeBinding[] {
	const fallback = defaultRuntimeBindings(registry, workflow, manifest);
	const existing = registry.runtimeBindings ?? [];
	const valid = existing.filter((binding): binding is AgentRuntimeBinding =>
		binding?.version === "1" && !!binding.id && !!binding.identityId && !!binding.roleId &&
		!!binding.executorId && Array.isArray(binding.capabilities) && Array.isArray(binding.stageIds),
	);
	const known = new Set(valid.map((binding) => `${binding.identityId}:${binding.roleId}`));
	return [...valid, ...fallback.filter((binding) => !known.has(`${binding.identityId}:${binding.roleId}`))]
		.sort((left, right) => left.id.localeCompare(right.id));
}

/** Resolves one binding; no generic executor fallback is permitted. */
export function resolveRuntimeBinding(input: {
	registry: AgentRegistry;
	workflow: Workflow;
	manifest: HarnessManifest | null;
	stageId: string;
	actor: string;
	capability: string;
	executors: AgenticExecutor[];
}): RuntimeBindingResolution {
	const identity = input.registry.agents.find((agent) => agent.id === input.actor || identityRoles(agent).includes(input.actor));
	if (!identity) return { ok: false, reasonCode: "IDENTITY_NOT_FOUND", reason: `Persona ${input.actor} não está registrada.` };
	const stage = input.manifest?.flows[input.workflow.template ?? "flow-main"]?.stages.find((entry) => entry.id === input.stageId);
	const roleId = stage?.agents.find((role) => identityRoles(identity).includes(role));
	if (!roleId) return { ok: false, identity, reasonCode: "ROLE_NOT_ALLOWED", reason: `A persona ${identity.displayName} não possui papel permitido em ${input.stageId}.` };
	if (!identity.stageBindings.includes(input.stageId)) return { ok: false, identity, reasonCode: "STAGE_NOT_ALLOWED", reason: `A persona ${identity.displayName} não atua no estágio ${input.stageId}.` };
	const bindings = normalizeRuntimeBindings(input.registry, input.workflow, input.manifest)
		.filter((binding) => binding.identityId === identity.id && binding.roleId === roleId && binding.stageIds.includes(input.stageId));
	if (bindings.length === 0) return { ok: false, identity, reasonCode: "NO_COMPATIBLE_BINDING", reason: `Nenhum vínculo operacional foi configurado para ${identity.displayName}.` };
	const configuredExecutors = new Set(input.manifest?.executors?.executors.map((executor) => executor.id) ?? []);
	if (configuredExecutors.size > 0 && bindings.some((binding) => !configuredExecutors.has(binding.executorId))) {
		return { ok: false, identity, reasonCode: "ORPHAN_REFERENCE", reason: `O vínculo de ${identity.displayName} referencia um executor que não existe no harness.` };
	}
	const preferred = candidateExecutorIds(input.manifest ?? { executors: undefined } as HarnessManifest, input.stageId);
	bindings.sort((left, right) => {
		const leftIndex = preferred.indexOf(left.executorId); const rightIndex = preferred.indexOf(right.executorId);
		return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex) || left.id.localeCompare(right.id);
	});
	for (const binding of bindings) {
		const executor = input.executors.find((candidate) => candidate.id === binding.executorId);
		if (!executor || executor.status === "offline") continue;
		if (!binding.capabilities.includes(input.capability) || !executorSupports(executor, input.capability)) continue;
		return { ok: true, binding, identity, executor };
	}
	const registered = bindings.some((binding) => input.executors.some((executor) => executor.id === binding.executorId && executor.status !== "offline"));
	return { ok: false, identity, reasonCode: registered ? "CAPABILITY_INSUFFICIENT" : "EXECUTOR_OFFLINE", reason: registered ? `Executor vinculado não possui capability ${input.capability}.` : `Executor vinculado para ${identity.displayName} está offline.` };
}

/** Derives UI presence from claims and executor health; it never writes agent status. */
export function projectAgentPresence(
	registryOrAgents: Pick<AgentRegistry, "agents" | "runtimeBindings"> | AgentIdentity[],
	workflow: Workflow,
	executors: AgenticExecutor[] = [],
): AgentIdentity[] {
	const registry = Array.isArray(registryOrAgents)
		? { agents: registryOrAgents, runtimeBindings: [] as AgentRuntimeBinding[] }
		: registryOrAgents;
	return registry.agents.map((agent) => {
		const roles = identityRoles(agent);
		const bindings = (registry.runtimeBindings ?? []).filter((binding) =>
			binding.identityId === agent.id || roles.includes(binding.roleId),
		);
		const bindingExecutorIds = new Set(bindings.map((binding) => binding.executorId));
		const boundExecutors = executors.filter((executor) => bindingExecutorIds.has(executor.id));
		const hasActiveClaimForAgent = workflow.items.some((item) => {
			return hasActiveClaim(item) &&
				(item.claimedBy === agent.id || roles.includes(item.claimedBy ?? "")) &&
				(!item.claimExecutorId || bindingExecutorIds.size === 0 || bindingExecutorIds.has(item.claimExecutorId));
		});
		if (hasActiveClaimForAgent) return { ...agent, status: "busy" as const };
		// A persona is only online when one of *its* bindings has a healthy
		// executor. A healthy executor for another persona must not change this
		// projection.
		if (bindings.length > 0) {
			return {
				...agent,
				status: boundExecutors.some((executor) => executor.status !== "offline")
					? "online" as const
					: "offline" as const,
			};
		}
		// Compatibility for registries created before runtime bindings existed.
		if (executors.length > 0 && executors.every((executor) => executor.status === "offline")) return { ...agent, status: "offline" as const };
		return { ...agent, status: "online" as const };
	});
}

export function bindingsChanged(registry: AgentRegistry, bindings: AgentRuntimeBinding[]): boolean {
	return stable(registry.runtimeBindings ?? []) !== stable(bindings);
}
