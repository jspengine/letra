import { resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { DiagnosticEngine } from "../diagnostics/engine.js";
import type { DiagnosticResult } from "../diagnostics/types.js";
import { logEntry } from "../session-log.js";
import {
	loadHealthRecord,
	saveHealthRecord,
	mergeScanResults,
	ackEntry,
	dismissEntry,
	getSummary,
	getActiveEntries,
} from "../health-record.js";
import { loadWorkflow, detectExistingTools } from "./flow-init.js";
import { generateAdapters } from "../adapters/generate.js";

export default function () {
	const cmd = new Command("health").description(
		"Manage health record — persistent diagnostic state",
	);

	cmd.option("--json", "Output in JSON format")
		.option("--all", "Show all entries including resolved and dismissed")
		.action((options: { json?: boolean; all?: boolean }) => {
			const root = resolve(process.cwd());
			const record = loadHealthRecord(root);
			const summary = getSummary(record);

			if (options.json) {
				console.log(JSON.stringify({ summary, entries: record.entries }, null, 2));
				return;
			}

			console.log(`\n${chalk.bold("📋 Prontuário de Saúde")}\n`);

			console.log(
				`  ${chalk.red(`${summary.novo} novo(s)${summary.alta > 0 ? ` (${summary.alta} crítico(s))` : ""}`)}`,
			);
			console.log(`  ${chalk.yellow(`${summary.ciente} em acompanhamento`)}`);
			console.log(`  ${chalk.gray(`${summary.resolvido} resolvido(s)`)}`);
			console.log(`  ${chalk.gray(`${summary.descartado} descartado(s)`)}`);
			console.log();

			if (summary.novo === 0 && summary.ciente === 0) {
				console.log("  Nenhum alerta ativo. Tudo ok.");
			}

			const entries = options.all ? record.entries : getActiveEntries(record);
			if (entries.length > 0) {
				for (const entry of entries) {
					const color =
						entry.severity === "alta"
							? chalk.red
							: entry.severity === "media"
								? chalk.yellow
								: chalk.blue;
					console.log(`  ${color(entry.id)} — ${entry.title}`);
					console.log(
						`       ${chalk.gray(`${entry.status} | ${entry.severity} | ${entry.source} | ${new Date(entry.detectedAt).toLocaleString()}`)}`,
					);
				}
				console.log();
			}
		});

	cmd.command("scan")
		.description("Run diagnostics and merge into health record")
		.action(async () => {
			const root = resolve(process.cwd());
			const engine = new DiagnosticEngine(root);
			engine.ensureDirs();
			const output = await engine.runAll();

			const suggestions: DiagnosticResult[] = output.suggestions.map((s) => ({
				id: s.id,
				type: s.type,
				title: s.title,
				description: s.description,
				certainty: 0.8,
				detector: s.detector,
			}));

			const record = loadHealthRecord(root);
			mergeScanResults(record, suggestions);
			saveHealthRecord(root, record);

			logEntry(
				root,
				"health_scan",
				`Scan de saúde executado — ${output.fixes.length} auto-correção(ões), ${output.suggestions.length} sugestão(ões)`,
				{
					details: { fixes: output.fixes.length, suggestions: output.suggestions.length },
				},
			);

			const wf = loadWorkflow(root);
			if (wf) {
				const activeStageId =
					wf.stages.find((s) => wf.items.some((i) => i.stage === s.id))?.id ??
					wf.stages[0]?.id;
				if (activeStageId) {
					generateAdapters(root, wf.tools, {
						source: "flow-move",
						workflow: wf,
						activeStageId,
						quiet: true,
						verb: "Updated",
					});
				}
			}
			console.log(
				chalk.green(
					`\n✅ Scan concluído. ${output.fixes.length} auto-correção(ões), ${output.suggestions.length} sugestão(ões) registradas.\n`,
				),
			);
		});

	cmd.command("ack <id>")
		.description("Acknowledge a health entry")
		.action((id: string) => {
			const root = resolve(process.cwd());
			const record = loadHealthRecord(root);
			if (ackEntry(record, id)) {
				saveHealthRecord(root, record);
				const wf = loadWorkflow(root);
				if (wf) {
					const activeStageId =
						wf.stages.find((s) => wf.items.some((i) => i.stage === s.id))?.id ??
						wf.stages[0]?.id;
					if (activeStageId) {
						generateAdapters(root, wf.tools, {
							source: "flow-move",
							workflow: wf,
							activeStageId,
							quiet: true,
							verb: "Updated",
						});
					}
				}
				logEntry(root, "health_ack", `Alerta ${id} reconhecido`);
				console.log(chalk.green(`Entrada ${id} reconhecida.`));
			} else {
				console.log(chalk.red(`Entrada ${id} não encontrada.`));
				process.exit(1);
			}
		});

	cmd.command("dismiss <id>")
		.description("Dismiss a health entry")
		.option("--reason <reason>", "Dismiss reason")
		.action((id: string, options: { reason?: string }) => {
			const root = resolve(process.cwd());
			const record = loadHealthRecord(root);
			if (dismissEntry(record, id, options.reason)) {
				saveHealthRecord(root, record);
				const wf = loadWorkflow(root);
				if (wf) {
					const activeStageId =
						wf.stages.find((s) => wf.items.some((i) => i.stage === s.id))?.id ??
						wf.stages[0]?.id;
					if (activeStageId) {
						generateAdapters(root, wf.tools, {
							source: "flow-move",
							workflow: wf,
							activeStageId,
							quiet: true,
							verb: "Updated",
						});
					}
				}
				logEntry(
					root,
					"health_dismiss",
					`Alerta ${id} descartado${options.reason ? `: ${options.reason}` : ""}`,
					{
						details: { reason: options.reason },
					},
				);
				console.log(chalk.green(`Entrada ${id} descartada.`));
			} else {
				console.log(chalk.red(`Entrada ${id} não encontrada.`));
				process.exit(1);
			}
		});

	return cmd;
}
