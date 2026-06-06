import { Command } from "commander";
import { flowInitAction } from "./flow-init.js";

export default function flowCommand() {
	const cmd = new Command("flow");

	cmd
		.command("init [path]")
		.option("--quick", "Quick setup with 3 questions only")
		.description("Initialize workflow in .letra/workflow.json")
		.action((path: string | undefined, options: { quick?: boolean }) => {
			flowInitAction(path, { quick: options.quick });
		});

	return cmd;
}
