import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAgent, listAgents, loadAgents, updateAgent } from "./service.js";
import type { Workflow } from "@letra/types";

const workflow = { stages: [{ id: "code", name: "Code", order: 1, allow: ["implementer"] }] } as Workflow;
describe("agent registry", () => {
	it("migrates role defaults and persists a versioned registry", () => {
		const root = mkdtempSync(join(tmpdir(), "letra-agents-"));
		writeFileSync(join(root, "workflow.json"), "{}");
		const registry = loadAgents(root, workflow);
		expect(registry.version).toBe("1");
		expect(registry.agents[0].displayName).toBe("Implementador");
		expect(JSON.parse(readFileSync(join(root, "agents.json"), "utf8")).version).toBe("1");
	});
	it("supports CRUD", () => {
		const root = mkdtempSync(join(tmpdir(), "letra-agents-"));
		writeFileSync(join(root, "workflow.json"), "{}");
		const agent = { id: "x", displayName: "X", role: "reviewer", avatar: { type: "initials" as const, value: "X" }, color: "red", skills: [], status: "offline" as const, stageBindings: [] };
		createAgent(root, agent, workflow); updateAgent(root, "x", { bio: "Review" }, workflow);
		expect(listAgents(root, workflow).find((item) => item.id === "x")?.bio).toBe("Review");
	});
});
