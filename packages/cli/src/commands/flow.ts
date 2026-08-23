import { Command } from "commander";
import chalk from "chalk";
import { backlogActionAdd, backlogActionList } from "./flow-backlog.js";
import { flowBoardAction } from "./flow-board.js";
import { flowDiffAction, flowEditAction } from "./flow-edit-diff.js";
import { flowExportAction, flowImportAction } from "./flow-export-import.js";
import { backlogImportGitHubAction, backlogImportLinearAction } from "./flow-import-issues.js";
import { flowInitAction } from "./flow-init.js";
import { flowMoveAction } from "./flow-move.js";
import { claimAction, releaseAction } from "./flow-claim.js";
import { handoffAction } from "./flow-handoff.js";
import { flowAcAction } from "./flow-ac.js";
import { flowServeAction } from "./flow-serve.js";
import { flowVisualizeAction } from "./flow-visualize.js";
import { flowPhasesAction, flowPhaseTransitionAction } from "./flow-phases.js";
import { flowAutopilotAction } from "./flow-autopilot.js";
import { flowPhaseRunAction } from "./flow-phase-run.js";
import { flowBindAction } from "./flow-bind.js";

export default function flowCommand() {
	const cmd = new Command("flow");

	cmd.command("init [path]")
		.option("--quick", "Quick setup with 3 questions only")
		.option("--template <name>", "Template to use (default: flow-main)")
		.description("Initialize workflow in .letra/workflow.json")
		.action((path: string | undefined, options: { quick?: boolean; template?: string }) => {
			flowInitAction(path, { quick: options.quick, template: options.template });
		});

	cmd.command("start")
		.option("--template <name>", "Template to use (default: flow-main)")
		.description("Quick start workflow with SDLC default template")
		.action((options: { template?: string }) => {
			flowInitAction(undefined, { quick: true, template: options.template || "flow-main" });
		});

	const backlog = cmd.command("backlog").description("Manage backlog items");

	backlog
		.command("add <description>")
		.option("--spec <name>", "Spec name to link")
		.description("Add item to the first stage")
		.action((description: string, options: { spec?: string }) => {
			backlogActionAdd(undefined, description, options.spec);
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
		.option("--to <stage>", "Target stage id or name")
		.option("--auto", "Automatically discover next stage by order")
		.option("--force", "Skip pre-move validation (pending ACs, etc)")
		.description("Move item to another stage and regenerate adapters")
		.action((itemId: string, options: { to?: string; auto?: boolean; force?: boolean }) => {
			if (!options.to && !options.auto) {
				console.log(chalk.red("Either --to or --auto is required"));
				process.exit(1);
			}
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

	cmd.command("claim <item-id>")
		.description("Claim an item (mark as being worked on)")
		.action(async (itemId: string) => {
			await claimAction(undefined, itemId);
		});

	cmd.command("release")
		.option("--item <id>", "Specific item to release (releases all by default)")
		.description("Release claimed item(s)")
		.action(async (options: { item?: string }) => {
			await releaseAction(undefined, options);
		});

	cmd.command("handoff <item-id>")
		.option("--to <agent>", "Target agent role (e.g., reviewer, security)")
		.option("--summary <text>", "Handoff summary")
		.option("--evidence <items...>", "Evidence files or descriptions")
		.option("--executor <id>", "Executor ID performing the handoff")
		.option("--rollback", "Rollback the last handoff")
		.description("Handoff item to another agent or rollback")
		.action(async (itemId: string, options: { to?: string; summary?: string; evidence?: string[]; executor?: string; rollback?: boolean }) => {
			await handoffAction(undefined, itemId, options);
		});

	cmd.command("ac <item-id> <ac-number>")
		.description("Mark an acceptance criterion as completed in the spec file")
		.action((itemId: string, acNumber: string) => {
			flowAcAction(undefined, itemId, acNumber);
		});

	cmd.command("edit")
		.option("--name <name>", "New workflow name")
		.option("--desc <desc>", "New workflow description")
		.description("Edit workflow metadata")
		.action((options: { name?: string; desc?: string }) => {
			flowEditAction(undefined, options);
		});

	cmd.command("bind")
		.requiredOption("--template <id>", "Flow template id from the harness")
		.requiredOption("--harness-version <version>", "Versioned harness tag (for example: v0.1.1)")
		.description("Bind the current workflow to a versioned harness flow")
		.action(async (options: { template: string; harnessVersion: string }) => {
			await flowBindAction(undefined, options);
		});

	cmd.command("diff [v1] [v2]")
		.description("Show diff between workflow versions")
		.action((...args: unknown[]) => {
			const strings = args.filter((a): a is string => typeof a === "string");
			flowDiffAction(undefined, strings[0], strings[1]);
		});

	cmd.command("phases <item-id>")
		.description("Show current phase for an item")
		.action((itemId: string) => {
			flowPhasesAction(itemId);
		});

	cmd.command("phase-transition <item-id> <phase>")
		.description("Transition item to another phase within current stage")
		.action((itemId: string, phase: string) => {
			flowPhaseTransitionAction(itemId, phase);
		});

	cmd.command("autopilot <item-id>")
		.description("Run auto-pilot: execute automatic transitions until a manual gate or stop")
		.action(async (itemId: string) => {
			await flowAutopilotAction(itemId);
		});

	cmd.command("phase-run <item-id>")
		.description("Execute actions of the current phase for an item")
		.action((itemId: string) => {
			flowPhaseRunAction(itemId);
		});

	return cmd;
}
