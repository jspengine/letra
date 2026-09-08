import type { AgentIdentity } from "@letra/types";
const roleAliases: Record<string, string> = { builder: "implementer", implementer: "implementer" };

export function resolveAgent(agents: AgentIdentity[], claimedBy?: string | null, actor?: { agentId?: string; toolId?: string }, executorId?: string | null): AgentIdentity | undefined {
 const raw=[actor?.agentId,claimedBy,executorId,actor?.toolId].filter(Boolean) as string[];
 const ids=[...raw, ...raw.map((id) => roleAliases[id] ?? id)];
 return agents.find(a=>ids.includes(a.id)) ?? agents.find(a=>ids.includes(a.role));
}
