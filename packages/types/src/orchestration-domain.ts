/** Canonical entities shared by workflow, protocol and execution projections. */
export interface WorkspaceEntity { id: string; root: string; harnessVersion: string; }
export interface RoleEntity { id: string; label: string; capabilities: string[]; allowedStages: string[]; }
export interface AgentIdentityEntity { id: string; displayName: string; roleIds: string[]; status: "online" | "offline" | "busy"; }
export interface ExecutorEntity { id: string; capabilities: string[]; status: "online" | "offline" | "busy"; }
export interface ActorBinding { actorId: string; identityId: string; roleId: string; executorId: string; }
export interface WorkItemEntity { id: string; workspaceId: string; specId?: string; stage: string; }
export interface ClaimEntity { itemId: string; actorId: string; executorId: string; capability: string; revision: string; expiresAt: string; }
export interface HandoffEntity { itemId: string; fromActorId: string; toActorId: string; evidenceIds: string[]; createdAt: string; expiresAt: string; }
export interface GateDecisionEntity { id: string; itemId: string; gateId: string; decision: "approve" | "request-changes" | "reject"; decidedBy: string; decidedAt: string; }
export interface EvidenceEntity { id: string; itemId: string; kind: "diff" | "file" | "command" | "test" | "artifact"; uri: string; sha256?: string; observedAt: string; }
export interface RunEntity { id: string; itemId: string; binding: ActorBinding; claim?: ClaimEntity; handoffs: HandoffEntity[]; gateDecisions: GateDecisionEntity[]; evidence: EvidenceEntity[]; status: "queued" | "running" | "failed" | "completed" | "waiting-human"; }

export interface DomainCatalog {
	workspace: WorkspaceEntity;
	roles: RoleEntity[];
	identities: AgentIdentityEntity[];
	executors: ExecutorEntity[];
}

export interface DomainValidationIssue { code: "ORPHAN_ROLE" | "ORPHAN_EXECUTOR" | "CAPABILITY_MISMATCH" | "DUPLICATE_ID" | "INVALID_BINDING"; path: string; message: string; }

/** Resolves the binding in one deterministic order: identity, role, then executor. */
export function resolveActorBinding(catalog: DomainCatalog, identityId: string, roleId: string, preferredExecutorId?: string): ActorBinding | null {
	const identity = catalog.identities.find((entry) => entry.id === identityId);
	const role = catalog.roles.find((entry) => entry.id === roleId);
	if (!identity || !role || !identity.roleIds.includes(roleId)) return null;
	const candidates = catalog.executors.filter((executor) => executor.status !== "offline" && role.capabilities.every((capability) => executor.capabilities.includes(capability)));
	const executor = (preferredExecutorId && candidates.find((entry) => entry.id === preferredExecutorId)) ?? candidates.sort((a, b) => a.id.localeCompare(b.id))[0];
	return executor ? { actorId: `${identity.id}:${role.id}:${executor.id}`, identityId: identity.id, roleId: role.id, executorId: executor.id } : null;
}

export function validateDomain(catalog: DomainCatalog, runs: RunEntity[] = []): DomainValidationIssue[] {
	const issues: DomainValidationIssue[] = [];
	const checkUnique = (kind: string, entries: Array<{ id: string }>) => { const seen = new Set<string>(); for (const entry of entries) { if (seen.has(entry.id)) issues.push({ code: "DUPLICATE_ID", path: `${kind}.${entry.id}`, message: `ID duplicado: ${entry.id}` }); seen.add(entry.id); } };
	checkUnique("roles", catalog.roles); checkUnique("identities", catalog.identities); checkUnique("executors", catalog.executors);
	for (const identity of catalog.identities) for (const roleId of identity.roleIds) if (!catalog.roles.some((role) => role.id === roleId)) issues.push({ code: "ORPHAN_ROLE", path: `identities.${identity.id}.roleIds`, message: `Role órfão: ${roleId}` });
	for (const role of catalog.roles) if (!catalog.executors.some((executor) => executor.status !== "offline" && role.capabilities.every((capability) => executor.capabilities.includes(capability)))) issues.push({ code: "CAPABILITY_MISMATCH", path: `roles.${role.id}`, message: `Nenhum executor online suporta as capabilities de ${role.id}` });
	for (const run of runs) { const binding = resolveActorBinding(catalog, run.binding.identityId, run.binding.roleId, run.binding.executorId); if (!binding || binding.actorId !== run.binding.actorId) issues.push({ code: "INVALID_BINDING", path: `runs.${run.id}.binding`, message: "ActorBinding não pode ser resolvido deterministicamente" }); }
	return issues;
}
