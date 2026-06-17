import { resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { queryLog, logEntry } from "../session-log.js";

export default function () {
	const cmd = new Command("log")
		.description("Session log — continuity between agent sessions");

	cmd
		.option("--all", "Show all entries")
		.option("--json", "Output in JSON format")
		.option("--item <id>", "Filter by item ID")
		.option("--action <action>", "Filter by action type")
		.option("--since <date>", "Filter by date (ISO or YYYY-MM-DD)")
		.action((options: { all?: boolean; json?: boolean; item?: string; action?: string; since?: string }) => {
			const root = resolve(process.cwd());
			const entries = queryLog(root, {
				all: options.all,
				itemId: options.item,
				action: options.action,
				since: options.since,
			});

			if (options.json) {
				console.log(JSON.stringify({ entries }, null, 2));
				return;
			}

			if (entries.length === 0) {
				console.log("Nenhum registro encontrado.");
				return;
			}

			console.log(`\n${chalk.bold("📓 Diário de Bordo")}${options.all ? " (todos)" : " (últimos 10)"}\n`);

			for (const entry of entries) {
				const actionColor = actionColors[entry.action] ?? chalk.white;
				console.log(`  ${chalk.gray(entry.id)} ${actionColor(entry.action)} ${chalk.gray(new Date(entry.timestamp).toLocaleString())}`);
				console.log(`    ${entry.description}`);
				if (entry.itemId) console.log(`    ${chalk.cyan(`item: ${entry.itemId}${entry.acId ? ` | ac: ${entry.acId}` : ""}`)}`);
				console.log();
			}
		});

	cmd
		.command("add <description>")
		.option("--item <id>", "Associated item ID")
		.option("--ac <id>", "Associated AC ID")
		.description("Add a manual log entry")
		.action((description: string, options: { item?: string; ac?: string }) => {
			const root = resolve(process.cwd());
			logEntry(root, "manual", description, {
				itemId: options.item,
				acId: options.ac,
			});
			console.log(chalk.green("Registro adicionado ao diário de bordo."));
		});

	cmd
		.command("ac <acId>")
		.option("--item <id>", "Associated item ID")
		.description("Register an AC as completed")
		.action((acId: string, options: { item?: string }) => {
			const root = resolve(process.cwd());
			logEntry(root, "ac_done", `AC ${acId} concluído${options.item ? ` (${options.item})` : ""}`, {
				itemId: options.item,
				acId,
			});
			console.log(chalk.green(`AC ${acId} registrado como concluído.`));
		});

	cmd
		.command("session-end")
		.description("Mark end of session")
		.option("--item <id>", "Current item at end of session")
		.action((options: { item?: string }) => {
			const root = resolve(process.cwd());
			logEntry(root, "session_end", "Sessão encerrada", { itemId: options.item });
			console.log(chalk.green("Fim de sessão registrado."));
		});

	return cmd;
}

const actionColors: Record<string, (s: string) => string> = {
	validate: (s: string) => chalk.blue(s),
	diagnose: (s: string) => chalk.blue(s),
	health_scan: (s: string) => chalk.magenta(s),
	health_ack: (s: string) => chalk.magenta(s),
	health_dismiss: (s: string) => chalk.magenta(s),
	ac_complete: (s: string) => chalk.green(s),
	ac_done: (s: string) => chalk.green(s),
	item_move: (s: string) => chalk.cyan(s),
	decision: (s: string) => chalk.yellow(s),
	sitrep: (s: string) => chalk.blue(s),
	focus_set: (s: string) => chalk.cyan(s),
	manual: (s: string) => chalk.white(s),
	session_end: (s: string) => chalk.red(s),
};
