import { Command } from "commander";
import chalk from "chalk";
import { resolve } from "node:path";
import { resolveLocalIdentity } from "../identity/service.js";
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
import {
	workflowDraftCommand,
	workflowDraftRevisionsCommand,
	workflowTemplateCommand,
	workflowAdaptersCommand,
	workflowLocationsCommand,
	workflowListCommands,
	workflowPublishCommand,
	workflowRollbackCommand,
	workflowShowCommand,
	workflowUpdateDraftCommand,
	workflowValidateCommand,
	workflowVersionsCommand,
} from "./flow-workflow.js";

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
		.option("--force", "Administratively bypass pending AC validation")
		.option("--actor <actor>", "Auditable human identity required with --force")
		.option("--reason <reason>", "Auditable reason required with --force")
		.description("Move item to another stage and regenerate adapters")
		.action((itemId: string, options: { to?: string; auto?: boolean; force?: boolean; actor?: string; reason?: string }) => {
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
		.option("--autopilot", "Enable deterministic semiautonomous dispatcher (human gates still block)")
		.description("Start local web server with live board")
		.action((options: { port?: string; open?: boolean; autopilot?: boolean }) => {
			flowServeAction(undefined, {
				port: options.port ? Number(options.port) : undefined,
				open: options.open,
				autopilot: options.autopilot,
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
		.action(
			async (
				itemId: string,
				options: {
					to?: string;
					summary?: string;
					evidence?: string[];
					executor?: string;
					rollback?: boolean;
				},
			) => {
				await handoffAction(undefined, itemId, options);
			},
		);

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
		.requiredOption(
			"--harness-version <version>",
			"Versioned harness tag (for example: v0.1.1)",
		)
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

		const workflow = cmd.command("workflow").description("Manage versioned workflow definitions");

		workflow
			.command("list")
			.description("List all workflow definitions")
			.action(() => {
				workflowListCommands(resolve(process.cwd()));
			});

		workflow
			.command("show <id>")
			.description("Show workflow definition details")
			.action((id: string) => {
				workflowShowCommand(resolve(process.cwd()), id);
			});

		workflow
			.command("draft <id>")
			.option("--actor <actor>", "Identity actor", undefined)
			.option("--based-on <version>", "Base version number", undefined)
			.description("Create a draft for editing")
			.action((id: string, options: { actor: string; basedOn?: string }) => {
				const actor = options.actor ?? resolveLocalIdentity(resolve(process.cwd())).id;
				workflowDraftCommand(resolve(process.cwd()), id, actor, options.basedOn ? Number(options.basedOn) : undefined);
			});

		workflow
			.command("validate <id>")
			.description("Validate current draft")
			.action((id: string) => {
				workflowValidateCommand(resolve(process.cwd()), id);
			});

		workflow
			.command("publish <id>")
			.option("--actor <actor>", "Identity actor", undefined)
			.requiredOption("--revision <revision>", "Expected revision number")
			.requiredOption("--reason <reason>", "Publication reason")
			.description("Publish current draft as new version")
			.action((id: string, options: { actor: string; revision: string; reason: string }) => {
				const actor = options.actor ?? resolveLocalIdentity(resolve(process.cwd())).id;
				workflowPublishCommand(resolve(process.cwd()), id, actor, Number(options.revision), options.reason);
			});

		workflow
			.command("rollback <id>")
			.option("--actor <actor>", "Identity actor", undefined)
			.requiredOption("--version <version>", "Version number to restore")
			.requiredOption("--reason <reason>", "Rollback reason")
			.description("Rollback to a previous version (publishes new derived version)")
			.action((id: string, options: { actor: string; version: string; reason: string }) => {
				const actor = options.actor ?? resolveLocalIdentity(resolve(process.cwd())).id;
				workflowRollbackCommand(resolve(process.cwd()), id, actor, Number(options.version), options.reason);
			});

		workflow
			.command("versions <id>")
			.description("List all published versions")
			.action((id: string) => {
				workflowVersionsCommand(resolve(process.cwd()), id);
			});

		workflow
			.command("history <id>")
			.description("List draft revision history")
			.action((id: string) => {
				workflowDraftRevisionsCommand(resolve(process.cwd()), id);
			});

		workflow
			.command("template <id>")
			.option("--template <name>", "Template name")
			.option("--name <name>", "Workflow name")
			.option("--actor <actor>", "Identity actor", undefined)
			.description("Create workflow from template")
			.action((id: string, options: { template?: string; name?: string; actor: string }) => {
				const actor = options.actor ?? resolveLocalIdentity(resolve(process.cwd())).id;
				workflowTemplateCommand(resolve(process.cwd()), id, actor, options.template ?? "", options);
			});

		workflow
			.command("adapters <id>")
			.option("--tools <tools>", "Comma-separated tools")
			.option("--list", "List active adapters")
			.option("--actor <actor>", "Identity actor", undefined)
			.description("Manage workflow adapters")
			.action((id: string, options: { tools?: string; list?: boolean; actor: string }) => {
				const actor = options.actor ?? resolveLocalIdentity(resolve(process.cwd())).id;
				workflowAdaptersCommand(resolve(process.cwd()), id, { tools: options.tools, list: options.list });
			});

		workflow
			.command("locations <id>")
			.option("--add <path>", "Add location")
			.option("--remove <id>", "Remove location")
			.option("--list", "List locations")
			.option("--actor <actor>", "Identity actor", undefined)
			.description("Manage workflow locations")
			.action((id: string, options: { add?: string; remove?: string; list?: boolean; actor: string }) => {
				const actor = options.actor ?? resolveLocalIdentity(resolve(process.cwd())).id;
				workflowLocationsCommand(resolve(process.cwd()), id, { add: options.add, remove: options.remove, list: options.list });
			});

		return cmd;
}
