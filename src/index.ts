import { Command } from "commander";
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
	.description("Initialize .letra/ directory with templates")
	.action(init);

program
	.command("spec <name>")
	.description("Create a new spec from template")
	.action(specNew);

program
	.command("lint [path]")
	.description("Validate spec format and completeness")
	.action(lint);

program
	.command("validate [path]")
	.description("Check if artifacts meet acceptance criteria")
	.action(validate);

program.parse();
