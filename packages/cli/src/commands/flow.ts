import { Command } from "commander";
import { backlogActionAdd, backlogActionList } from "./flow-backlog.js";
import { flowBoardAction } from "./flow-board.js";
import { flowDiffAction, flowEditAction } from "./flow-edit-diff.js";
import { flowExportAction, flowImportAction } from "./flow-export-import.js";
import { backlogImportGitHubAction, backlogImportLinearAction } from "./flow-import-issues.js";
import { flowInitAction } from "./flow-init.js";
import { flowMoveAction } from "./flow-move.js";
import { flowServeAction } from "./flow-serve.js";
import { flowVisualizeAction } from "./flow-visualize.js";

export default function flowCommand() {
	const cmd = new Command("flow");

	cmd.command("init [path]")
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

	const importCmd = backlog.command("import").description("Import issues from external sources");

	importCmd
		.command("github <repo>")
		.option("--label <label>", "Filter by label")
		.option("--limit <number>", "Max issues to import", "50")
		.description("Import open issues from a GitHub repository")
		.action((repo: string, options: { label?: string; limit?: string }) => {
			backlogImportGitHubAction(undefined, repo, options);
		});

	importCmd
		.command("linear <team>")
		.option("--limit <number>", "Max issues to import", "50")
		.description("Import issues from a Linear team")
		.action((team: string, options: { limit?: string }) => {
			backlogImportLinearAction(undefined, team, options);
		});

	cmd.command("move <item-id>")
		.requiredOption("--to <stage>", "Target stage id or name")
		.description("Move item to another stage and regenerate adapters")
		.action((itemId: string, options: { to: string }) => {
			flowMoveAction(undefined, itemId, options);
		});

	cmd.command("board")
		.description("Show board with all stages and items")
		.action(() => {
			flowBoardAction(undefined);
		});

	cmd.command("export")
		.option("--minified", "Output JSON without indentation")
		.description("Export workflow to stdout")
		.action((options: { minified?: boolean }) => {
			flowExportAction(undefined, options);
		});

	cmd.command("import <file>")
		.description("Import workflow from a JSON file")
		.action((file: string) => {
			flowImportAction(undefined, file);
		});

	cmd.command("serve")
		.option("--port <number>", "Port to listen on", "3000")
		.option("--open", "Open browser automatically")
		.description("Start local web server with live board")
		.action((options: { port?: string; open?: boolean }) => {
			flowServeAction(undefined, {
				port: options.port ? Number(options.port) : undefined,
				open: options.open,
			});
		});

	cmd.command("visualize")
		.option("--output <file>", "Save diagram to file")
		.description("Generate Mermaid diagram of workflow")
		.action((options: { output?: string }) => {
			flowVisualizeAction(undefined, options);
		});

	cmd.command("edit")
		.option("--name <name>", "New workflow name")
		.option("--desc <desc>", "New workflow description")
		.description("Edit workflow metadata")
		.action((options: { name?: string; desc?: string }) => {
			flowEditAction(undefined, options);
		});

	cmd.command("diff [v1] [v2]")
		.description("Show diff between workflow versions")
		.action((...args: unknown[]) => {
			const strings = args.filter((a): a is string => typeof a === "string");
			flowDiffAction(undefined, strings[0], strings[1]);
		});

	return cmd;
}
