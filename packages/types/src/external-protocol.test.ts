import { describe, expect, it } from "vitest";
import type {
	ExternalProtocolActor,
	ExternalProtocolContext,
	ExternalProtocolExecutor,
} from "./index.js";

describe("external executor protocol types", () => {
	it("describes the actor and executor identity required by AC1", () => {
		const actor: ExternalProtocolActor = {
			agentId: "agent-analyst-1",
			displayName: "Analyst",
			toolId: "claude-code",
			toolVersion: "1.0.0",
		};
		const executor: ExternalProtocolExecutor = {
			id: "claude-code-local",
			capabilities: ["read_context", "write_code"],
			status: "online",
			transport: "cli",
			maxExecutionTime: 1800,
		};
		const context: ExternalProtocolContext = {
			schemaVersion: "1",
			workspace: { workspaceId: "ws_letra", workspaceRoot: "C:/Workspace/letra" },
			actor,
			executor,
			revision: "sha256:" + "a".repeat(64),
			timestamp: "2026-09-08T00:00:00.000Z",
		};

		expect(context.actor.toolId).toBe("claude-code");
		expect(context.executor.capabilities).toContain("write_code");
		expect(context.workspace.workspaceId).toBe("ws_letra");
	});
});
