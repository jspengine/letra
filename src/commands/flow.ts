import { Command } from "commander";
import { backlogActionAdd, backlogActionList } from "./flow-backlog.js";
import { flowBoardAction } from "./flow-board.js";
import { flowExportAction, flowImportAction } from "./flow-export-import.js";
import { flowInitAction } from "./flow-init.js";
import { flowMoveAction } from "./flow-move.js";
import { flowVisualizeAction } from "./flow-visualize.js";

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

	cmd
		.command("board")
		.description("Show board with all stages and items")
		.action(() => {
			flowBoardAction(undefined);
		});

	cmd
		.command("export")
		.option("--minified", "Output JSON without indentation")
		.description("Export workflow to stdout")
		.action((options: { minified?: boolean }) => {
			flowExportAction(undefined, options);
		});

	cmd
		.command("import <file>")
		.description("Import workflow from a JSON file")
		.action((file: string) => {
			flowImportAction(undefined, file);
		});

	cmd
		.command("visualize")
		.option("--output <file>", "Save diagram to file")
		.description("Generate Mermaid diagram of workflow")
		.action((options: { output?: string }) => {
			flowVisualizeAction(undefined, options);
		});

	return cmd;
}
