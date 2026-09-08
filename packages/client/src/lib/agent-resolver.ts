import type { AgentIdentity } from "@letra/types";

export function resolveAgent(agents: AgentIdentity[], claimedBy?: string | null, actor?: { agentId?: string; toolId?: string }, executorId?: string | null): AgentIdentity | undefined {
 const ids=[actor?.agentId,claimedBy,executorId,actor?.toolId].filter(Boolean) as string[];
 return agents.find(a=>ids.includes(a.id)) ?? agents.find(a=>ids.includes(a.role));
}
