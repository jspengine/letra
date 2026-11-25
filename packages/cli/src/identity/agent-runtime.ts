import { resolveLocalIdentity } from "./service.js";

/**
 * ITEM-51 (spec actor-real-na-auditoria): the CLI cannot tell who typed a
 * command, but agent runtimes mark the environment they run commands in. When
 * a marker is present the CLI records the agent as the actor instead of the
 * local human identity, so the audit trail names who actually acted and human
 * operations are refused by the domain's own human checks.
 *
 * This guards against mistakes, not fraud: an agent that deliberately strips
 * its environment is out of scope (strong identity is a separate item).
 */
export type AgentEnv = Record<string, string | undefined>;

/** Runtime markers set by the agent tools themselves, in precedence order. */
const RUNTIME_MARKERS: ReadonlyArray<{ variable: string; runtime: string }> = [
	{ variable: "CLAUDECODE", runtime: "claude-code" },
	{ variable: "CODEX_SANDBOX", runtime: "codex" },
	{ variable: "CODEX_SANDBOX_NETWORK_DISABLED", runtime: "codex" },
	{ variable: "CURSOR_AGENT", runtime: "cursor" },
];

/** `AI_AGENT=claude-code_2-1-330_agent` → `claude-code`. */
function runtimeFromAiAgent(value: string): string {
	const name = value.trim().toLowerCase().match(/^[a-z0-9-]+/)?.[0];
	return name || "agent";
}

/** The agent runtime running this process, or null for a human terminal. */
export function detectAgentRuntime(env: AgentEnv = process.env): string | null {
	const aiAgent = env.AI_AGENT?.trim();
	if (aiAgent) return runtimeFromAiAgent(aiAgent);
	for (const { variable, runtime } of RUNTIME_MARKERS) {
		if (env[variable]?.trim()) return runtime;
	}
	return null;
}

/**
 * The actor the CLI records for this process. Inside an agent it is
 * `agent:<runtime>`; an explicit role (e.g. `--actor reviewer`) is kept, but an
 * explicit human identity is never honoured. Outside an agent nothing changes:
 * the explicit actor, else the local human identity.
 */
export function resolveCliActor(root: string, explicit?: string, env: AgentEnv = process.env): string {
	const requested = explicit?.trim() || undefined;
	const runtime = detectAgentRuntime(env);
	if (runtime) return requested && !requested.startsWith("human") ? requested : `agent:${runtime}`;
	return requested ?? resolveLocalIdentity(root).id;
}
