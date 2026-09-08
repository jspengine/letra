import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ActiveFlowDefinition } from "../../lib/active-flow";
import FlowConfigurationMap from "./FlowConfigurationMap";

const flow: ActiveFlowDefinition = {
	id: "flow-test", source: "workflow-template", harnessVersion: "v2", templateVersion: "1",
	name: "Test flow", warnings: [], roles: [{ id: "builder", label: "Builder", description: "", allowedStages: ["code"], capabilities: ["write", "test"] }],
	stages: [{ id: "code", name: "Code", order: 1, zone: "doing", description: "Implementa", roleIds: ["builder"], roles: [{ id: "builder", label: "Builder", description: "", allowedStages: ["code"], capabilities: ["write", "test"] }], agents: ["builder"], preferredExecutor: "opencode", gate: null, provenance: "harness", phases: { initialState: "work", states: { work: { id: "work", label: "Trabalho", description: "", transitions: [{ target: "review", gate: null }] } } } }],
};

describe("FlowConfigurationMap", () => {
	it("renders the complete harness contract", () => {
		render(<FlowConfigurationMap stages={flow.stages} activeFlow={flow} />);
		expect(screen.getByText("Executor: opencode")).toBeTruthy();
		expect(screen.getByText("Fases: Trabalho")).toBeTruthy();
		expect(screen.getByText("Transições: Trabalho → review")).toBeTruthy();
		expect(screen.getByText("write")).toBeTruthy();
	});

	it("labels legacy provenance when no active flow exists", () => {
		render(<FlowConfigurationMap stages={[]} activeFlow={null} />);
		expect(screen.getByText(/fonte: instância do workflow/)).toBeTruthy();
	});
});
