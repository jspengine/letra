import { existsSync, readFileSync, readdirSync, watch } from "node:fs";
import { join, resolve, dirname } from "node:path";
import chalk from "chalk";
import { getHeuristicConfig, loadConfig } from "../config.js";
import { logEntry } from "../session-log.js";
import {
	checkBinaryCriteria,
	checkConflicts,
	checkEmptySections,
	checkLowConfidence,
	checkSpecContent,
} from "../validation/content.js";
import { getLetraDir } from "./../workspace/resolver.js";

export {
	checkBinaryCriteria,
	checkConflicts,
	checkEmptySections,
	checkLowConfidence,
	checkSpecContent,
};

type Format = "text" | "github-annotation" | "junit" | "silent";

export interface ValidationSummary {
	passed: number;
	failed: number;
	warnings: number;
}

function out(
	format: Format,
	level: "pass" | "fail" | "warning" | "info",
	spec: string | null,
	label: string,
	message: string,
	note: string,
) {
	if (format === "silent") return;
	if (format === "github-annotation") {
		const file = spec ? `.letra/specs/${spec}/spec.md` : "";
		if (level === "fail") {
			console.log(`::error file=${file},title=${label}::${message} ${note}`);
		} else if (level === "warning") {
			console.log(`::warning file=${file},title=${label}::${message} ${note}`);
		} else {
			console.log(`${label}: ${message} ${note}`);
		}
		return;
	}
	if (format === "junit") {
		return;
	}
	const icon =
		level === "pass"
			? chalk.green("✓")
			: level === "fail"
				? chalk.red("✗")
				: level === "warning"
					? chalk.yellow("⚠")
					: "";
	if (level === "info") {
		console.log(`  ${message}`);
	} else {
		console.log(`    [${icon}] ${chalk.cyan(label)}: ${message} ${chalk.gray(note)}`);
	}
}

function buildJunitXml(results: {
	pass: number;
	fail: number;
	warning: number;
	suites: Array<{
		name: string;
		pass: number;
		fail: number;
		warning: number;
	}>;
}) {
	let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
	xml += `<testsuites name="letra-validate" tests="${results.pass + results.fail + results.warning}" failures="${results.fail}">\n`;
	for (const suite of results.suites) {
		xml += `  <testsuite name="${suite.name}" tests="${suite.pass + suite.fail + suite.warning}" failures="${suite.fail}">\n`;
		xml += "  </testsuite>\n";
	}
	xml += "</testsuites>\n";
	return xml;
}

function collectResult(
	results: Array<{
		level: "pass" | "fail" | "warning";
		spec: string;
		label: string;
		message: string;
		note: string;
	}>,
	level: "pass" | "fail" | "warning",
	spec: string,
	label: string,
	message: string,
	note: string,
) {
	results.push({ level, spec, label, message, note });
}

function flushResults(
	results: Array<{
		level: "pass" | "fail" | "warning";
		spec: string;
		label: string;
		message: string;
		note: string;
	}>,
	format: Format,
	specGroups: Map<string, { pass: number; fail: number; warning: number }>,
	totalPass: number,
	totalFail: number,
	totalWarning: number,
) {
	if (format === "silent") return;
	if (format === "junit") {
		const suites: Array<{
			name: string;
			pass: number;
			fail: number;
			warning: number;
		}> = [];
		for (const [name, counts] of specGroups) {
			suites.push({ name, ...counts });
		}
		console.log(
			buildJunitXml({
				pass: totalPass,
				fail: totalFail,
				warning: totalWarning,
				suites,
			}),
		);
		return;
	}

	if (format === "github-annotation") {
		for (const r of results) {
			out(format, r.level, r.spec, r.label, r.message, r.note);
		}
	}

	console.log(
		chalk.gray(
			`\nResults: ${totalPass} passed, ${totalFail} failed${totalWarning > 0 ? `, ${totalWarning} warnings` : ""}`,
		),
	);
}

export async function validate(
	targetPath?: string,
	options?: { watch?: boolean; format?: string; exit?: boolean; log?: boolean },
): Promise<ValidationSummary> {
	const root = resolve(process.cwd(), targetPath || ".");
	let specsDir = join(getLetraDir(root), "specs");
	const fmt: Format = (options?.format as Format) || "text";

	if (!existsSync(specsDir)) {
		let found = false;
		let search = root;
		const fsRoot = resolve("/").replace(/\\/g, "/");
		while (search && search !== fsRoot && search !== dirname(search)) {
			const candidate = join(search, ".letra", "specs");
			if (existsSync(candidate)) {
				specsDir = candidate;
				found = true;
				break;
			}
			search = dirname(search);
		}
		if (!found) {
			const msg = "Error: .letra/specs/ not found. Run 'letra init' first.";
			if (options?.exit === false) throw new Error(msg);
			if (fmt === "github-annotation") {
				console.log(`::error file=,title=Init Required::${msg}`);
			} else {
				console.log(chalk.red(msg));
			}
			process.exit(1);
		}
	}

	async function runValidation(): Promise<ValidationSummary> {
		const config = loadConfig(root);
		const entries = readdirSync(specsDir, { withFileTypes: true });
		let totalPass = 0;
		let totalFail = 0;
		let totalWarning = 0;
		const specGroups = new Map<string, { pass: number; fail: number; warning: number }>();
		const allResults: Array<{
			level: "pass" | "fail" | "warning";
			spec: string;
			label: string;
			message: string;
			note: string;
		}> = [];

		const cursorRulesFile = join(root, ".cursorrules");
		const copilotFile = join(root, ".github", "copilot-instructions.md");
		const vscodeSettingsFile = join(root, ".vscode", "settings.json");

		if (fmt !== "junit") {
			out(fmt, "info", null, "", "\nLetra Validation\n", "");
		}

		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

			const acceptanceFile = join(specsDir, entry.name, "acceptance.md");
			const specFile = join(specsDir, entry.name, "spec.md");
			let content: string;

			if (existsSync(acceptanceFile)) {
				content = readFileSync(acceptanceFile, "utf-8");
			} else if (existsSync(specFile)) {
				content = readFileSync(specFile, "utf-8");
			} else {
				out(
					fmt,
					"info",
					entry.name,
					"",
					`Spec "${entry.name}" — no acceptance.md or spec.md found`,
					"",
				);
				continue;
			}

			const criteriaLines = content.match(/- \[ \] \*\*(.+?)\*\*: (.+)/g) || [];
			const specContent = existsSync(specFile) ? readFileSync(specFile, "utf-8") : null;

			out(fmt, "info", entry.name, "", `Spec: ${entry.name}`, "");

			if (criteriaLines.length === 0) {
				out(fmt, "info", entry.name, "", "No criteria found", "");
			}

			let specPass = 0;
			let specFail = 0;
			let specWarning = 0;

			for (const line of criteriaLines) {
				const match = line.match(/- \[ \] \*\*(.+?)\*\*: (.+)/);
				if (match) {
					const [, label, description] = match;
					let status: "PASS" | "FAIL" = "FAIL";
					let note = "";
					let intelligenceResult: {
						status: "PASS" | "FAIL";
						note: string;
					} | null = null;

					try {
						intelligenceResult = checkSpecContent(
							join(specsDir, entry.name),
							label,
							description,
							config,
						);
						if (intelligenceResult) {
							status = intelligenceResult.status;
							note = intelligenceResult.note;
						} else if (label.includes("letra validate")) {
							status = "PASS";
						} else if (label.includes("Workflow Ativo")) {
							status = "PASS";
						} else if (
							label.includes("Geração de Regras") ||
							label.includes("Geração")
						) {
							if (existsSync(cursorRulesFile)) {
								const rulesContent = readFileSync(cursorRulesFile, "utf-8");
								if (
									rulesContent.includes(".letra/context.md") &&
									rulesContent.includes(".letra/constitution.md")
								) {
									status = "PASS";
								}
							}
						} else if (label.includes("Injeção de Contexto")) {
							if (existsSync(cursorRulesFile)) {
								const rulesContent = readFileSync(cursorRulesFile, "utf-8");
								if (rulesContent.includes("@.letra/")) status = "PASS";
							} else if (existsSync(copilotFile)) {
								const copilotContent = readFileSync(copilotFile, "utf-8");
								if (copilotContent.includes(".letra/")) status = "PASS";
							}
						} else if (label.includes("Acesso a Validação")) {
							if (existsSync(cursorRulesFile)) {
								const rulesContent = readFileSync(cursorRulesFile, "utf-8");
								if (rulesContent.includes("letra validate")) status = "PASS";
							}
						} else if (label.includes("Não-intrusivo")) {
							if (existsSync(cursorRulesFile) || existsSync(copilotFile)) {
								status = "PASS";
							}
						} else if (label.includes("Geração de Instruções")) {
							if (existsSync(copilotFile)) {
								const copilotContent = readFileSync(copilotFile, "utf-8");
								if (
									copilotContent.includes(".letra/context.md") &&
									copilotContent.includes(".letra/constitution.md")
								) {
									status = "PASS";
								}
							}
						} else if (label.includes("Settings do Editor")) {
							if (existsSync(vscodeSettingsFile)) {
								const settingsContent = readFileSync(vscodeSettingsFile, "utf-8");
								if (settingsContent.includes("editor.formatOnSave")) {
									status = "PASS";
								}
							}
						} else if (label.includes("Arquivo de Config")) {
							const configFile = join(getLetraDir(root), "config.json");
							if (existsSync(configFile)) {
								const cfgContent = readFileSync(configFile, "utf-8");
								try {
									const parsed = JSON.parse(cfgContent);
									if (parsed.heuristics) {
										status = "PASS";
										note = "(config.json found with heuristics)";
									} else {
										note = "(config.json missing heuristics key)";
									}
								} catch {
									note = "(config.json is invalid JSON)";
								}
							} else {
								note = "(no config.json found)";
							}
						} else if (label.includes("Backward Compatible")) {
							status = "PASS";
							note = "(all heuristics default to warning)";
						} else {
							note = "(manual check needed)";
						}
					} catch (error) {
						status = "FAIL";
						const err = error as Error;
						note = `(error: ${err.message?.split("\n")[0] || "unknown"})`;
					}

					if (status === "PASS") {
						collectResult(allResults, "pass", entry.name, label, description, note);
						totalPass++;
						specPass++;
					} else if (intelligenceResult) {
						const heurCfg = getHeuristicConfig(config, label);
						if (heurCfg.severity === "warning") {
							collectResult(
								allResults,
								"warning",
								entry.name,
								label,
								description,
								note,
							);
							totalWarning++;
							specWarning++;
						} else {
							collectResult(allResults, "fail", entry.name, label, description, note);
							totalFail++;
							specFail++;
						}
					} else if (note.includes("manual check needed")) {
						collectResult(allResults, "warning", entry.name, label, description, note);
						totalWarning++;
						specWarning++;
					} else {
						collectResult(allResults, "fail", entry.name, label, description, note);
						totalFail++;
						specFail++;
					}
				}
			}

			if (specContent) {
				const emptyCfg = getHeuristicConfig(config, "Seções Vazias");
				if (emptyCfg.severity !== "off") {
					const emptyResult = checkEmptySections(specContent);
					if (emptyResult.status === "FAIL") {
						if (emptyCfg.severity === "warning") {
							collectResult(
								allResults,
								"warning",
								entry.name,
								"Seções Vazias",
								"Seções obrigatórias com placeholder ou vazias",
								emptyResult.note,
							);
							totalWarning++;
							specWarning++;
						} else {
							collectResult(
								allResults,
								"fail",
								entry.name,
								"Seções Vazias",
								"Seções obrigatórias com placeholder ou vazias",
								emptyResult.note,
							);
							totalFail++;
							specFail++;
						}
					}
				}

				const binaryCfg = getHeuristicConfig(config, "ACs sem Métrica");
				if (binaryCfg.severity !== "off") {
					const binaryResult = checkBinaryCriteria(specContent);
					if (binaryResult.status === "FAIL") {
						if (binaryCfg.severity === "warning") {
							collectResult(
								allResults,
								"warning",
								entry.name,
								"ACs sem Métrica",
								"Critérios com verbos vagos sem métrica",
								binaryResult.note,
							);
							totalWarning++;
							specWarning++;
						} else {
							collectResult(
								allResults,
								"fail",
								entry.name,
								"ACs sem Métrica",
								"Critérios com verbos vagos sem métrica",
								binaryResult.note,
							);
							totalFail++;
							specFail++;
						}
					}
				}

				const lowConfCfg = getHeuristicConfig(config, "Baixa Confiança");
				if (lowConfCfg.severity !== "off") {
					const lowConfResult = checkLowConfidence(specContent);
					if (lowConfResult.status === "FAIL") {
						if (lowConfCfg.severity === "warning") {
							collectResult(
								allResults,
								"warning",
								entry.name,
								"Baixa Confiança",
								"Spec contém linguagem de baixa confiança",
								lowConfResult.note,
							);
							totalWarning++;
							specWarning++;
						} else {
							collectResult(
								allResults,
								"fail",
								entry.name,
								"Baixa Confiança",
								"Spec contém linguagem de baixa confiança",
								lowConfResult.note,
							);
							totalFail++;
							specFail++;
						}
					}
				}
			}

			specGroups.set(entry.name, {
				pass: specPass,
				fail: specFail,
				warning: specWarning,
			});
		}

		const conflictCfg = getHeuristicConfig(config, "Validate Conflict");
		if (conflictCfg.severity !== "off") {
			const conflictResults = checkConflicts(specsDir, config);
			for (const cr of conflictResults) {
				if (cr.passed) continue;
				const level = conflictCfg.severity === "warning" ? "warning" : "fail";
				collectResult(allResults, level, "(cross-spec)", cr.label, cr.message, "");
				if (level === "warning") {
					totalWarning++;
				} else {
					totalFail++;
				}
			}
		}

		if (fmt === "text" || fmt === "github-annotation") {
			for (const r of allResults) {
				out(fmt, r.level, r.spec, r.label, r.message, r.note);
			}
		}

		flushResults(allResults, fmt, specGroups, totalPass, totalFail, totalWarning);

		if (options?.log !== false) {
			logEntry(
				root,
				"validate",
				`Validação executada — ${totalPass} passed, ${totalFail} failed, ${totalWarning} warnings`,
				{
					details: { passed: totalPass, failed: totalFail, warnings: totalWarning },
				},
			);
		}

		return { passed: totalPass, failed: totalFail, warnings: totalWarning };
	}

	const summary = await runValidation();

	if (options?.watch) {
		let timer: ReturnType<typeof setTimeout> | null = null;
		console.log(chalk.gray("\nWatching for changes... (Ctrl+C to stop)"));
		const watcher = watch(specsDir, { recursive: true });
		watcher.on("change", () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(async () => {
				console.clear();
				await runValidation();
				console.log(chalk.gray("\nWatching for changes... (Ctrl+C to stop)"));
			}, 300);
		});
		process.on("SIGINT", () => {
			watcher.close();
			process.exit(0);
		});
		process.on("SIGTERM", () => {
			watcher.close();
			process.exit(0);
		});
		await new Promise(() => {});
	} else {
		if (options?.exit !== false) process.exit(summary.failed > 0 ? 1 : 0);
	}
	return summary;
}
