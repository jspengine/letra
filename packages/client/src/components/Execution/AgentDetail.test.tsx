import type { ResolvedFlowDefinition, Workflow } from "@letra/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AgentDetail from "./AgentDetail";

const workflow: Workflow = {
	version: "1.0",
	name: "Arbitrary workspace",
	createdAt: "2026-07-01T00:00:00.000Z",
	updatedAt: "2026-07-01T00:00:00.000Z",
	stages: [{ id: "legacy", name: "Legacy", order: 0 }],
	items: [
		{
			id: "ITEM-A",
			description: "Observed work",
			stage: "alpha-x",
			createdAt: "2026-07-01T00:00:00.000Z",
			claimedBy: "runtime-actor",
		},
	],
	tools: [],
};

const activeFlow: ResolvedFlowDefinition = {
	id: "arbitrary",
	source: "workflow-template",
	harnessVersion: "v-test",
	templateVersion: "1.0.0",
	name: "Arbitrary Flow",
	stages: [
		{
			id: "alpha-x",
			name: "Intent Work",
			order: 0,
			zone: "doing",
			roleIds: ["operator"],
			roles: [],
			agents: ["operator"],
			gate: null,
			provenance: "harness",
		},
	],
	roles: [
		{
			id: "operator",
			label: "Flow Operator",
			description: "Operates declared work.",
			allowedStages: ["alpha-x"],
			capabilities: ["artifact:write"],
		},
	],
	warnings: [],
};

describe("AgentDetail", () => {
	it("renders declared roles and observed actors without synthetic telemetry", () => {
		render(<AgentDetail workflow={workflow} activeFlow={activeFlow} />);

		expect(screen.getByText("Flow Operator")).toBeTruthy();
		expect(screen.getAllByText("Intent Work")).toHaveLength(2);
		expect(screen.getByText("artifact:write")).toBeTruthy();
		expect(screen.getByText("runtime-actor")).toBeTruthy();
		expect(screen.queryByText(/Claude|GPT|Gemini|success rate|model/i)).toBeNull();
	});
});
