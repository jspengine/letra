import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import decisionCommand from "./commands/decision.js";
import flowCommand from "./commands/flow.js";
import focus from "./commands/focus.js";
import healthCommand from "./commands/health.js";
import logCommand from "./commands/log.js";
import pulseCommand from "./commands/pulse.js";
import sitrepCommand from "./commands/sitrep.js";
import syncCommand from "./commands/sync.js";
import acCommand from "./commands/ac.js";
import { init } from "./commands/init.js";
import { lint } from "./commands/lint.js";
import { specLink, specNew } from "./commands/spec.js";
import { validate } from "./commands/validate.js";
import { diagnose } from "./commands/diagnose.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pkg = JSON.parse(readFileSync(join(resolve(__dirname, ".."), "package.json"), "utf-8"));

const program = new Command();

program
	.name("letra")
	.description("SDD-agnostic memory framework for AI coding agents")
	.version(pkg.version);

program
	.command("init [path]")
	.option("--yes", "Skip prompts and use defaults")
	.option("--serve", "Open web UI after init (starts flow serve)")
	.description("Initialize .letra/ directory with templates")
	.action((path, options) => init(path, { ...options }));

const specCmd = program.command("spec").description("Manage specs");

specCmd
	.command("new <name>")
	.option("--template <type>", "Template type: web-api, cli-tool, mobile-feature")
	.description("Create a new spec from template")
	.action((name, options) => specNew(name, { ...options }));

specCmd
	.command("link <item-id> <spec-name>")
	.description("Link an existing spec to an item")
	.action((itemId, specName) => specLink(itemId, specName));

program.command("lint [path]").description("Validate spec format and completeness").action(lint);

program
	.command("validate [path]")
	.option("--watch", "Watch specs and re-validate on change")
	.option("--format <type>", "Output format: text, github-annotation, junit")
	.description("Check if artifacts meet acceptance criteria")
	.action((path, options) => validate(path, { ...options }));

program
	.command("diagnose [path]")
	.description("Detect and fix drifts between specs, code, and workflow")
	.action((path) => diagnose(path));

program.addCommand(acCommand());
program.addCommand(decisionCommand());
program.addCommand(flowCommand());
program.addCommand(focus());
program.addCommand(healthCommand());
program.addCommand(logCommand());
program.addCommand(pulseCommand());
program.addCommand(sitrepCommand());
program.addCommand(syncCommand());

program.parse();
