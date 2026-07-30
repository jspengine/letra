import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { logEntry } from "../session-log.js";

const GATE_DIR = join(".letra", "harness", "gates");

export default function gateCommand() {
	const cmd = new Command("gate");
	cmd.description("Gerenciar gates do harness");

	cmd
		.command("approve <id>")
		.description("Marca um gate como approved")
		.action((id: string) => {
			const root = process.cwd();
			const candidates = [join(root, GATE_DIR, `${id}.yaml`), join(root, GATE_DIR, `${id}.yml`)];

			const file = candidates.find((c) => existsSync(c));
			if (!file) {
				console.error(`${chalk.red("Gate não encontrado:")} ${id}`);
				console.error(`Procurado em: ${candidates.join(", ")}`);
				process.exitCode = 1;
				return;
			}

			let raw = readFileSync(file, "utf-8");
			if (raw.includes("status: approved")) {
				console.log(chalk.yellow(`Gate "${id}" já estava approved.`));
				return;
			}

			if (raw.includes("status:")) {
				raw = raw.replace(/^status:.*$/m, "status: approved");
			} else {
				raw = raw.trimEnd() + "\nstatus: approved\n";
			}

			writeFileSync(file, raw, "utf-8");
			logEntry(root, "system", `gate approve ${id}`, { details: { gateId: id } });
			console.log(chalk.green(`Gate "${id}" aprovado.`));
			console.log(chalk.dim(`Arquivo: ${file}`));
		});

	return cmd;
}
