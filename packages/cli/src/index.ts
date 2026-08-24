import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import decisionCommand from "./commands/decision.js";
import flowCommand from "./commands/flow.js";
import focus from "./commands/focus.js";
import healthCommand from "./commands/health.js";
import logCommand from "./commands/log.js";
import migrateCommand from "./commands/migrate.js";
import pulseCommand from "./commands/pulse.js";
import sitrepCommand from "./commands/sitrep.js";
import syncCommand from "./commands/sync.js";
import acCommand from "./commands/ac.js";
import activityContextCommand from "./commands/activity-context.js";
import directionCommand from "./commands/direction.js";
import mcpCommand from "./commands/mcp.js";
import operationCommand from "./commands/operation.js";
import { init } from "./commands/init.js";
import { lint } from "./commands/lint.js";
import { specLink, specNew } from "./commands/spec.js";
import { validate } from "./commands/validate.js";
import { diagnose } from "./commands/diagnose.js";
import { status } from "./commands/status.js";
import gateCommand from "./commands/gate.js";
import { checkDs } from "./commands/check-ds.js";

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
	.option("--workspace <name>", "Create isolated workspace in ~/.letra/ (no local .letra/)")
	.option("--no-tui", "Disable TUI wizard, use text prompts")
	.description("Initialize .letra/ or workspace with templates")
	.action((path, options) => init(path, { ...options }));

program
	.command("setup [path]")
	.option("--port <number>", "Port for the web UI", "3000")
	.description("Open web UI setup wizard to configure a workspace")
	.action(async (path, options) => {
		const port = Number.parseInt(options.port, 10) || 3000;
		const { execSync } = await import("node:child_process");
		const { createConnection } = await import("node:net");
		const checkPort = (p: number) =>
			new Promise<boolean>((resolve) => {
				const client = createConnection(p, "127.0.0.1", () => {
					client.end();
					resolve(true);
				});
				client.on("error", () => resolve(false));
			});
		const isRunning = await checkPort(port);
		const cmd =
			process.platform === "win32"
				? "start"
				: process.platform === "darwin"
					? "open"
					: "xdg-open";
		const setupUrl = `http://localhost:${port}/?setup=true`;
		if (isRunning) {
			try {
				execSync(`${cmd} "${setupUrl}"`, { stdio: "ignore" });
			} catch {}
			console.log(`\n  Web UI already running → ${setupUrl}\n`);
		} else {
			console.log(`\n  Starting web UI on port ${port}...\n`);
			const root = resolve(process.cwd(), path ?? ".");
			const { FlowServer } = await import("./commands/flow-serve.js");
			const server = new FlowServer(root, port);
			try {
				await server.start();
				console.log(`\n  Setup Wizard → ${setupUrl}\n`);
				if (options.open !== false) {
					try {
						execSync(`${cmd} "${setupUrl}"`, { stdio: "ignore" });
					} catch {}
				}
				await new Promise<void>((resolve) => {
					process.on("SIGINT", () => {
						server.stop();
						resolve();
					});
				});
			} catch (err) {
				console.error(`Failed to start server on port ${port}:`, (err as Error).message);
				process.exit(1);
			}
		}
	});

program
	.command("status")
	.description("Show workspace status or list workspaces")
	.action(() => status());

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
	.command("check:ds [path]")
	.description("Validate client conformance with Letra Design System")
	.action(checkDs);

program
	.command("validate [path]")
	.option("--watch", "Watch specs and re-validate on change")
	.option("--format <type>", "Output format: text, github-annotation, junit")
	.description("Check if artifacts meet acceptance criteria")
	.action(async (path, options) => {
		await validate(path, { ...options });
	});

program
	.command("diagnose [path]")
	.description("Detect and fix drifts between specs, code, and workflow")
	.action((path) => diagnose(path));

program.addCommand(acCommand());
program.addCommand(activityContextCommand());
program.addCommand(directionCommand());
program.addCommand(mcpCommand());
program.addCommand(operationCommand());
program.addCommand(decisionCommand());
program
	.command("push [path]")
	.option("--dry-run", "Show what would be pushed without writing")
	.description("Sync workspace artifacts to target repository")
	.action((path, options) => import("./commands/push.js").then((m) => m.push(path, options)));

program.addCommand(flowCommand());
program.addCommand(focus());
program.addCommand(healthCommand());
program.addCommand(logCommand());
program.addCommand(pulseCommand());
program.addCommand(sitrepCommand());
program.addCommand(syncCommand());
program.addCommand(migrateCommand());
program.addCommand(gateCommand());

program.parse();
