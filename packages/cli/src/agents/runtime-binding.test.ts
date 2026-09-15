import { describe, expect, it } from "vitest";
import type { AgentRegistry, Workflow } from "@letra/types";
import type { HarnessManifest } from "../harness/types.js";
import { defaultRuntimeBindings, projectAgentPresence, resolveRuntimeBinding } from "./runtime-binding.js";

const workflow = { version: "1", name: "Test", createdAt: "", updatedAt: "", tools: [], template: "flow-main", harnessVersion: "v0.2.0", stages: [{ id: "design", name: "Design", order: 1 }, { id: "code", name: "Code", order: 2 }], items: [] } as Workflow;
const registry: AgentRegistry = { version: "1", updatedAt: "", agents: [{ id: "ada", displayName: "Ada Lovelace", role: "analyst", avatar: { type: "emoji", value: "🧮" }, color: "blue", skills: [{ id: "analysis", label: "Análise", level: "expert" }], status: "online", stageBindings: ["design"] }] };
const manifest: HarnessManifest = {
	version: "0.2.0", flows: { "flow-main": { id: "flow-main", version: "1", name: "Main", description: "", defaultPolicy: "", stages: [{ id: "design", name: "Design", order: 1, description: "", agents: ["analyst"], gate: null }, { id: "code", name: "Code", order: 2, description: "", agents: ["implementer"], gate: null }] } },
	gates: {}, roles: { analyst: { id: "analyst", label: "Analyst", description: "", allowedStages: ["design"], capabilities: ["read_code", "write_spec"] } }, policies: {},
	executors: { executors: [{ id: "codex", label: "Codex", capabilities: ["design"], notification: ["polling"], heartbeat: true, maxExecutionTime: 1800, priority: 1 }], stageExecutorPreferences: { design: ["codex"] } },
};
const codex = { id: "codex", label: "Codex", capabilities: ["design"], status: "online" as const, execute: async () => ({ success: true, output: "", artifacts: [], evidences: [] }) };

describe("agent runtime bindings", () => {
	it("creates a versioned binding and resolves the configured persona before a generic executor", () => {
		const bindings = defaultRuntimeBindings(registry, workflow, manifest);
		expect(bindings).toEqual([expect.objectContaining({ version: "1", identityId: "ada", roleId: "analyst", executorId: "codex", stageIds: ["design"] })]);
		const result = resolveRuntimeBinding({ registry: { ...registry, runtimeBindings: bindings }, workflow, manifest, stageId: "design", actor: "analyst", capability: "write_spec", executors: [codex] });
		expect(result).toMatchObject({ ok: true, identity: { displayName: "Ada Lovelace" }, executor: { id: "codex" } });
	});

	it("returns structured reasons for an offline executor and insufficient capability", () => {
		const bindings = defaultRuntimeBindings(registry, workflow, manifest);
		const offline = resolveRuntimeBinding({ registry: { ...registry, runtimeBindings: bindings }, workflow, manifest, stageId: "design", actor: "analyst", capability: "write_spec", executors: [{ ...codex, status: "offline" }] });
		expect(offline.reasonCode).toBe("EXECUTOR_OFFLINE");
		const insufficient = resolveRuntimeBinding({ registry: { ...registry, runtimeBindings: bindings }, workflow, manifest, stageId: "design", actor: "analyst", capability: "write_spec", executors: [{ ...codex, capabilities: ["review"] }] });
		expect(insufficient.reasonCode).toBe("CAPABILITY_INSUFFICIENT");
	});

	it("rejects an orphan executor reference before an item can be claimed", () => {
		const result = resolveRuntimeBinding({ registry: { ...registry, runtimeBindings: [{ ...defaultRuntimeBindings(registry, workflow, manifest)[0], executorId: "missing", id: "ada:analyst:missing" }] }, workflow, manifest, stageId: "design", actor: "analyst", capability: "write_spec", executors: [codex] });
		expect(result.reasonCode).toBe("ORPHAN_REFERENCE");
	});

	it("derives busy presence from a live claim instead of a persisted status", () => {
		const now = Date.now();
		const agents = projectAgentPresence(registry.agents, { ...workflow, items: [{ id: "ITEM-1", description: "", stage: "design", createdAt: "", claimedBy: "analyst", claimExpiresAt: new Date(now + 60_000).toISOString(), activityStatus: "started", lastHeartbeatAt: new Date(now - 1000).toISOString() }] });
		expect(agents[0].status).toBe("busy");
	});

	it("does not project stale activity or an expired claim as busy", () => {
		const now = Date.now();
		const agents = projectAgentPresence(registry.agents, { ...workflow, items: [{ id: "ITEM-1", description: "", stage: "design", createdAt: "", claimedBy: "analyst", claimExpiresAt: new Date(now - 1000).toISOString(), activityStatus: "started", lastHeartbeatAt: new Date(now - 1000).toISOString() }] });
		expect(agents[0].status).toBe("online");
	});

	it("derives each persona health from its own binding, never global executor health", () => {
		const alan = { ...registry.agents[0], id: "alan", displayName: "Alan Turing", role: "implementer", stageBindings: ["code"] };
		const bindings = [
			{ ...defaultRuntimeBindings(registry, workflow, manifest)[0], id: "ada:analyst:codex", identityId: "ada", roleId: "analyst", executorId: "codex", stageIds: ["design"] },
			{ ...defaultRuntimeBindings(registry, workflow, manifest)[0], id: "alan:implementer:cursor", identityId: "alan", roleId: "implementer", executorId: "cursor", stageIds: ["code"] },
		];
		const projected = projectAgentPresence(
			{ ...registry, agents: [registry.agents[0], alan], runtimeBindings: bindings },
			workflow,
			[{ ...codex, status: "online" }, { ...codex, id: "cursor", status: "offline" }],
		);
		expect(projected.map((agent) => [agent.id, agent.status])).toEqual([
			["ada", "online"],
			["alan", "offline"],
		]);
	});
});
