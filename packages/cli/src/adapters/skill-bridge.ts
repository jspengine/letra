import type { AgentIdentity } from "@letra/types";

/** Converts structured skills into deterministic adapter instructions. */
export function buildSkillInstructions(agent: AgentIdentity, adapter = "generic"): string {
	const lines = [`# Agent ${agent.displayName}`, `Role: ${agent.role}`, `Adapter: ${adapter}`];
	if (agent.bio) lines.push(`Purpose: ${agent.bio}`);
	if (agent.skills.length) {
		lines.push("Skills:");
		for (const skill of agent.skills) lines.push(`- ${skill.label} (${skill.level}${skill.category ? `, ${skill.category}` : ""})`);
	}
	const hint = agent.adapterHints?.[adapter] ?? agent.adapterHints?.generic;
	if (hint) lines.push("Instructions:", hint);
	return lines.join("\n");
}
export const skillBridge = buildSkillInstructions;
