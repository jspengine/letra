import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentIdentity, AgentRegistry, Workflow } from "@letra/types";
import { getLetraDir, resolveWorkspaceRoot } from "../workspace/resolver.js";

const DEFAULTS: Record<string, Omit<AgentIdentity, "id" | "role">> = {
	analyst: { displayName: "Analista", bio: "Analisa contexto e define direção.", avatar: { type: "emoji", value: "🔎" }, color: "oklch(0.72 0.14 220)", skills: [{ id: "analysis", label: "Análise", level: "expert", category: "process" }], status: "offline", stageBindings: ["design"], adapterHints: {} },
	implementer: { displayName: "Implementador", bio: "Transforma especificações em código.", avatar: { type: "emoji", value: "🛠️" }, color: "oklch(0.72 0.16 150)", skills: [{ id: "coding", label: "Implementação", level: "expert", category: "engineering" }], status: "offline", stageBindings: ["code"], adapterHints: {} },
	reviewer: { displayName: "Revisor", bio: "Confronta código, spec e evidências.", avatar: { type: "emoji", value: "🔍" }, color: "oklch(0.75 0.15 80)", skills: [{ id: "review", label: "Code review", level: "expert", category: "quality" }], status: "offline", stageBindings: ["review"], adapterHints: {} },
	security: { displayName: "Segurança", bio: "Avalia riscos e controles.", avatar: { type: "emoji", value: "🛡️" }, color: "oklch(0.68 0.18 25)", skills: [{ id: "security", label: "Segurança", level: "advanced", category: "quality" }], status: "offline", stageBindings: ["review"], adapterHints: {} },
};

function pathFor(root: string): string { return join(getLetraDir(root), "agents.json"); }
function assertAgent(agent: AgentIdentity): AgentIdentity {
	if (!agent || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(agent.id)) throw new Error("Agent id inválido");
	if (!agent.displayName?.trim() || !agent.role?.trim()) throw new Error("displayName e role são obrigatórios");
	if (!agent.avatar || !["emoji", "initials", "image"].includes(agent.avatar.type) || !agent.avatar.value?.trim()) throw new Error("avatar inválido");
	if (typeof agent.color !== "string" || !agent.color.trim()) throw new Error("color deve ser preenchida");
	if (!["online", "offline", "busy"].includes(agent.status)) throw new Error("status inválido");
	if (!Array.isArray(agent.skills) || agent.skills.some((s) => !s.id || !s.label || !["beginner", "intermediate", "advanced", "expert"].includes(s.level))) throw new Error("skills inválidas");
	if (!Array.isArray(agent.stageBindings) || (agent.adapterHints && typeof agent.adapterHints !== "object")) throw new Error("stageBindings ou adapterHints inválidos");
	return agent;
}
function defaults(workflow: Workflow): AgentIdentity[] {
	const roles = new Set(workflow.stages.flatMap((s) => s.allow ?? []));
	return [...roles].map((role) => ({ id: role, role, ...(DEFAULTS[role] ?? { displayName: role, bio: "Agente do harness.", avatar: { type: "initials" as const, value: role.slice(0, 2).toUpperCase() }, color: "oklch(0.7 0.12 280)", skills: [], status: "offline" as const, stageBindings: workflow.stages.filter((s) => (s.allow ?? []).includes(role)).map((s) => s.id), adapterHints: {} }) }));
}
export function defaultAgentIdentities(workflow: Workflow): AgentIdentity[] { return defaults(workflow); }
export function loadAgents(root: string, workflow?: Workflow): AgentRegistry {
	const file = pathFor(root);
	if (existsSync(file)) {
		try { const parsed = JSON.parse(readFileSync(file, "utf8")) as AgentRegistry; if (parsed?.version === "1" && Array.isArray(parsed.agents)) return { ...parsed, agents: parsed.agents.filter((a) => { try { assertAgent(a); return true; } catch { return false; } }) }; } catch { /* migrate below */ }
	}
	const registry: AgentRegistry = { version: "1", updatedAt: new Date().toISOString(), agents: workflow ? defaults(workflow) : [] };
	if (workflow) saveAgents(root, registry);
	return registry;
}
export function saveAgents(root: string, registry: AgentRegistry): void { const file = pathFor(root); mkdirSync(join(file, ".."), { recursive: true }); writeFileSync(file, JSON.stringify({ ...registry, version: "1", updatedAt: new Date().toISOString() }, null, 2) + "\n"); }
export function listAgents(root: string, workflow?: Workflow): AgentIdentity[] { return loadAgents(root, workflow).agents; }
export function createAgent(root: string, agent: AgentIdentity, workflow?: Workflow): AgentIdentity { const r = loadAgents(root, workflow); assertAgent(agent); if (r.agents.some((a) => a.id === agent.id)) throw new Error(`Agent ${agent.id} already exists`); r.agents.push(agent); saveAgents(root, r); return agent; }
export function updateAgent(root: string, id: string, patch: Partial<AgentIdentity>, workflow?: Workflow): AgentIdentity { const r = loadAgents(root, workflow); const i = r.agents.findIndex((a) => a.id === id); if (i < 0) throw new Error(`Agent ${id} not found`); const next = assertAgent({ ...r.agents[i], ...patch, avatar: patch.avatar ?? r.agents[i].avatar, skills: patch.skills ?? r.agents[i].skills, stageBindings: patch.stageBindings ?? r.agents[i].stageBindings, adapterHints: patch.adapterHints ?? r.agents[i].adapterHints, id }); r.agents[i] = next; saveAgents(root, r); return next; }
export function deleteAgent(root: string, id: string, workflow?: Workflow): void { const r = loadAgents(root, workflow); if (!r.agents.some((a) => a.id === id)) throw new Error(`Agent ${id} not found`); r.agents = r.agents.filter((a) => a.id !== id); saveAgents(root, r); }
export function agentsFor(root?: string, workflow?: Workflow): AgentIdentity[] { const resolved = resolveWorkspaceRoot(root); return listAgents(resolved.workspaceRoot, workflow); }
