import type { ResolvedFlowDefinition } from "@letra/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowDefinitionWarnings } from "./FlowDefinitionWarnings";

function flowWithWarning(): ResolvedFlowDefinition {
	return {
		id: "arbitrary",
		source: "workflow-template",
		harnessVersion: "v-test",
		templateVersion: "1.0.0",
		name: "Arbitrary Flow",
		stages: [],
		roles: [],
		warnings: [
			{
				code: "INSTANCE_STAGE_NOT_IN_TEMPLATE",
				message: "Compatibility extension is active.",
				artifactRef: 'workflow stage "alpha-x"',
			},
		],
	};
}

describe("FlowDefinitionWarnings", () => {
	it("renders flow degradation with code, message and artifact reference", () => {
		render(<FlowDefinitionWarnings activeFlow={flowWithWarning()} />);
		expect(screen.getByText("Flow ativo com 1 aviso")).toBeTruthy();
		expect(screen.getByText("INSTANCE_STAGE_NOT_IN_TEMPLATE")).toBeTruthy();
		expect(
			screen.getByText(/Compatibility extension is active.*workflow stage "alpha-x"/),
		).toBeTruthy();
	});

	it("renders nothing when the flow has no warnings", () => {
		const { container } = render(
			<FlowDefinitionWarnings activeFlow={{ ...flowWithWarning(), warnings: [] }} />,
		);
		expect(container.childElementCount).toBe(0);
	});
});
