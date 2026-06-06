import { Command } from "commander";
import { backlogActionAdd, backlogActionList } from "./flow-backlog.js";
import { flowInitAction } from "./flow-init.js";
import { flowMoveAction } from "./flow-move.js";

export default function flowCommand() {
	const cmd = new Command("flow");

	cmd
		.command("init [path]")
		.option("--quick", "Quick setup with 3 questions only")
		.description("Initialize workflow in .letra/workflow.json")
		.action((path: string | undefined, options: { quick?: boolean }) => {
			flowInitAction(path, { quick: options.quick });
		});

	const backlog = cmd.command("backlog").description("Manage backlog items");

	backlog
		.command("add <description>")
		.description("Add item to the first stage")
		.action((description: string) => {
			backlogActionAdd(undefined, description);
		});

	backlog
		.command("list")
		.description("List all items with stage and age")
		.action(() => {
			backlogActionList(undefined);
		});

	cmd
		.command("move <item-id>")
		.requiredOption("--to <stage>", "Target stage id or name")
		.description("Move item to another stage and regenerate adapters")
		.action((itemId: string, options: { to: string }) => {
			flowMoveAction(undefined, itemId, options);
		});

	return cmd;
}
