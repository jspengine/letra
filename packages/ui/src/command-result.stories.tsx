import "./index.css";
import { CommandResult } from "./command-result";

export const Success = () => (
	<CommandResult
		command="npm run build"
		output={"Build completed in 376ms\nGenerated dist/index.js"}
		exitCode={0}
	/>
);

export const Error = () => (
	<CommandResult
		command="letra validate"
		output={"Validation failed\nMissing evidence for AC3"}
		exitCode={1}
	/>
);

export default {
	title: "Components/CommandResult",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Terminal result primitive for command evidence. Keep command text and output readable without implying automated success.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: [
				"color-bg-sunken",
				"color-border",
				"color-success",
				"color-danger",
				"font-mono",
			],
			consumes: [],
			surfaces: ["ExecutionView", "FlowView"],
			a11y: ["monospace-output", "status-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
