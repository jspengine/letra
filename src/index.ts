import { Command } from "commander";
import decisionCommand from "./commands/decision.js";
import focus from "./commands/focus.js";
import { init } from "./commands/init.js";
import { lint } from "./commands/lint.js";
import { specNew } from "./commands/spec.js";
import { validate } from "./commands/validate.js";

const program = new Command();

program
	.name("letra")
	.description("SDD-agnostic memory framework for AI coding agents")
	.version("0.0.1");

program
	.command("init [path]")
	.option("--yes", "Skip prompts and use defaults")
	.description("Initialize .letra/ directory with templates")
	.action((path, options) => init(path, { ...options }));

program
	.command("spec <name>")
	.option(
		"--template <type>",
		"Template type: web-api, cli-tool, mobile-feature",
	)
	.description("Create a new spec from template")
	.action((name, options) => specNew(name, { ...options }));

program
	.command("lint [path]")
	.description("Validate spec format and completeness")
	.action(lint);

program
	.command("validate [path]")
	.option("--watch", "Watch specs and re-validate on change")
	.option("--format <type>", "Output format: text, github-annotation, junit")
	.description("Check if artifacts meet acceptance criteria")
	.action((path, options) => validate(path, { ...options }));

program.addCommand(decisionCommand());
program.addCommand(focus());

program.parse();
