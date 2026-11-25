import { resolve } from "node:path";
import { Command } from "commander";
import { inspectWorkspaceIntegrity } from "../workspace/integrity.js";

export function doctor(root = process.cwd()): ReturnType<typeof inspectWorkspaceIntegrity> {
	return inspectWorkspaceIntegrity(resolve(root));
}

export default function doctorCommand(): Command {
	return new Command("doctor")
		.description("Verifica a integridade semântica do workspace canônico")
		.option("--check", "Executa a verificação (opcional por compatibilidade)")
		.option("--json", "Imprime o relatório estruturado")
		.action((options: { json?: boolean }) => {
			const report = doctor();
			if (options.json) {
				process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
				if (!report.ok) process.exitCode = 2;
				return;
			}
			console.log(`${report.ok ? "✓" : "✗"} ${report.code}`);
			console.log(`  workspaceDir: ${report.resolution.workspaceDir}`);
			console.log(`  workspaceRoot: ${report.resolution.workspaceRoot}`);
			console.log(`  mode: ${report.resolution.mode}`);
			for (const drift of report.drifts) {
				console.log(`  ${drift.code}: ${drift.paths.join(" ↔ ")}`);
				console.log(`    recovery: ${drift.recovery}`);
			}
			if (!report.ok) process.exitCode = 2;
		});
}
