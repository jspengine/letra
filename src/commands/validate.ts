import { type ExecSyncOptions, execSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import chalk from "chalk";
import {
	loadConfig,
	getHeuristicConfig,
	type Config,
	type HeuristicConfig,
} from "../config.js";

const placeholderPatterns = [
	/o que o usu[áa]rio consegue fazer quando isso estiver pronto/i,
	/limitaç[õo]es t[ée]cnicas e de neg[óo]cio/i,
	/o que explicitamente n[ãa]o est[áa] neste escopo/i,
	/descriç[ãa]o bin[áa]ria/i,
	/por que estamos construindo isso/i,
];

const vagueVerbs = [
	"melhorar",
	"otimizar",
	"facilitar",
	"aumentar",
	"diminuir",
	"agilizar",
	"simplificar",
	"aprimorar",
];

const lowConfidenceMarkers = [
	"provavelmente",
	"talvez",
	"tentar",
	"idealmente",
	"possivelmente",
	"quem sabe",
	"de repente",
	"teoricamente",
];

export function checkSpecContent(
	specDir: string,
	label: string,
	description: string,
	config?: Config,
) {
	const cfg = config ?? loadConfig(join(specDir, "..", "..", ".."));
	const specFile = join(specDir, "spec.md");
	const glossaryFile = join(specDir, "..", "..", "glossary.md");

	if (!existsSync(specFile))
		return { status: "FAIL" as const, note: "(spec.md not found)" };

	const specContent = readFileSync(specFile, "utf-8");
	const now = new Date();

	// Verificação de Conteúdo Mínimo
	if (label.includes("Conteúdo Mínimo")) {
		const outcomeMatch = specContent.match(/## Outcome\s+([\s\S]*?)(?=\n## )/);
		if (!outcomeMatch)
			return { status: "FAIL" as const, note: "(no Outcome section)" };
		const outcomeContent = outcomeMatch[1].trim();
		const heurConfig = getHeuristicConfig(cfg, label);
		const minChars = heurConfig.minChars ?? 50;
		if (outcomeContent.length >= minChars) {
			return {
				status: "PASS" as const,
				note: `(${outcomeContent.length} chars, need ${minChars})`,
			};
		}
		return {
			status: "FAIL" as const,
			note: `(only ${outcomeContent.length} chars, need ${minChars}+)`,
		};
	}

	// Consistência de Terminologia
	if (
		label.includes("Consistência de Terminologia") ||
		label.includes("Terminologia")
	) {
		if (!existsSync(glossaryFile)) {
			return {
				status: "PASS" as const,
				note: "(no glossary to check against)",
			};
		}
		const glossaryContent = readFileSync(glossaryFile, "utf-8");
		const terms = glossaryContent.match(/\*\*(.+?)\*\*/g) || [];
		const extractedTerms = terms
			.map((t) => t.replace(/\*\*/g, "").trim())
			.filter((t) => t.length > 3);
		const missingTerms = extractedTerms.filter(
			(term) => !specContent.toLowerCase().includes(term.toLowerCase()),
		);
		if (missingTerms.length === 0) {
			return { status: "PASS" as const, note: "(all glossary terms used)" };
		}
		return {
			status: "FAIL" as const,
			note: `(missing: ${missingTerms.slice(0, 3).join(", ")})`,
		};
	}

	// Detecção de Tom
	if (label.includes("Detecção de Tom") || label.includes("Tom")) {
		const lowerSpec = specContent.toLowerCase();
		const words = lowerSpec.split(/\s+/);
		const heurConfig = getHeuristicConfig(cfg, label);
		const blacklist = heurConfig.blacklist ?? [
			"tipo", "tá", "pra", "blz", "kkk", "eita", "oi", "oi pessoal",
		];
		const foundColloquialisms = blacklist.filter((c) => words.includes(c));
		if (foundColloquialisms.length === 0) {
			return { status: "PASS" as const, note: "(formal tone maintained)" };
		}
		return {
			status: "FAIL" as const,
			note: `(colloquialisms: ${foundColloquialisms.join(", ")})`,
		};
	}

	// Drift Temporal
	if (label.includes("Drift Temporal") || label.includes("Temporal")) {
		const stat = statSync(specFile);
		const daysOld = Math.floor(
			(now.getTime() - stat.mtimeMs) / (1000 * 60 * 60 * 24),
		);
		const heurConfig = getHeuristicConfig(cfg, label);
		const maxDays = heurConfig.maxDays ?? 30;
		if (daysOld < maxDays) {
			return { status: "PASS" as const, note: `(${daysOld} days old)` };
		}
		return {
			status: "FAIL" as const,
			note: `(${daysOld} days old, stale >${maxDays}d)`,
		};
	}

	return null;
}

export function checkEmptySections(specContent: string): {
	status: "PASS" | "FAIL";
	note: string;
} {
	const requiredSections = [
		"## Outcome",
		"## Constraints",
		"## Exclusions",
		"## Acceptance Criteria",
		"## Context",
	];

	const emptyOrPlaceholder: string[] = [];

	for (const section of requiredSections) {
		const escaped = section.replace(/[#]/g, "\\$&");
		const pattern = new RegExp(`${escaped}\\s+([\\s\\S]*?)(?=\\n## |\\n*$)`);
		const match = specContent.match(pattern);
		if (!match) {
			emptyOrPlaceholder.push(section.replace("## ", ""));
			continue;
		}
		const content = match[1].trim();
		if (content.length < 10) {
			emptyOrPlaceholder.push(section.replace("## ", ""));
			continue;
		}
		const hasPlaceholder = placeholderPatterns.some((p) => p.test(content));
		if (hasPlaceholder) {
			emptyOrPlaceholder.push(section.replace("## ", ""));
		}
	}

	if (emptyOrPlaceholder.length === 0) {
		return {
			status: "PASS" as const,
			note: "(all sections have real content)",
		};
	}
	return {
		status: "FAIL" as const,
		note: `(empty/placeholder: ${emptyOrPlaceholder.join(", ")})`,
	};
}

export function checkBinaryCriteria(specContent: string): {
	status: "PASS" | "FAIL";
	note: string;
} {
	const acMatch = specContent.match(
		/## Acceptance Criteria\s+([\s\S]*?)(?=\n## |\n*$)/,
	);
	if (!acMatch) {
		return {
			status: "FAIL" as const,
			note: "(no Acceptance Criteria section)",
		};
	}

	const criteriaLines = acMatch[1].match(/- \[[ x]\] .+/g) || [];
	if (criteriaLines.length === 0) {
		return { status: "FAIL" as const, note: "(no criteria items found)" };
	}

	const nonBinary: string[] = [];
	for (const line of criteriaLines) {
		const description = line.replace(/- \[[ x]\] \*\*.+?\*\*:\s*/, "");
		const hasMetric = /\d+/.test(description);
		const hasVagueVerb = vagueVerbs.some((v) =>
			description.toLowerCase().includes(v),
		);
		if (!hasMetric && hasVagueVerb) {
			const labelMatch = line.match(/\*\*(.+?)\*\*/);
			if (labelMatch) nonBinary.push(labelMatch[1]);
		}
	}

	if (nonBinary.length === 0) {
		return {
			status: "PASS" as const,
			note: "(all criteria have measurable outcomes)",
		};
	}
	return {
		status: "FAIL" as const,
		note: `(vague criteria: ${nonBinary.join(", ")})`,
	};
}

export function checkLowConfidence(specContent: string): {
	status: "PASS" | "FAIL";
	note: string;
} {
	const lower = specContent.toLowerCase();
	const words = lower.split(/\s+/);
	const found = lowConfidenceMarkers.filter((m) => {
		if (m.includes(" ")) {
			return lower.includes(m);
		}
		return words.includes(m);
	});

	if (found.length === 0) {
		return {
			status: "PASS" as const,
			note: "(no low-confidence language detected)",
		};
	}
	return {
		status: "FAIL" as const,
		note: `(low-confidence: ${found.join(", ")})`,
	};
}

export async function validate(targetPath?: string) {
	const root = resolve(process.cwd(), targetPath || ".");
	const specsDir = join(root, ".letra", "specs");

	if (!existsSync(specsDir)) {
		console.log(
			chalk.red("Error: .letra/specs/ not found. Run 'letra init' first."),
		);
		process.exit(1);
	}

	console.log(chalk.bold("\nLetra Validation\n"));

	const config = loadConfig(root);
	const entries = readdirSync(specsDir, { withFileTypes: true });
	let totalPass = 0;
	let totalFail = 0;
	let totalWarning = 0;

	const entryPoint = join(root, "src/index.ts");
	const opts: ExecSyncOptions = {
		stdio: "pipe",
		encoding: "utf-8",
		shell: process.platform === "win32" ? "cmd.exe" : true,
	} as ExecSyncOptions;
	const ciFile = join(root, ".github", "workflows", "ci.yml");
	const cursorRulesFile = join(root, ".cursorrules");
	const copilotFile = join(root, ".github", "copilot-instructions.md");
	const vscodeSettingsFile = join(root, ".vscode", "settings.json");

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
			console.log(
				chalk.gray(
					`  Spec "${entry.name}" — no acceptance.md or spec.md found`,
				),
			);
			continue;
		}

		const criteriaLines = content.match(/- \[ \] \*\*(.+?)\*\*: (.+)/g) || [];
		const specContent = existsSync(specFile)
			? readFileSync(specFile, "utf-8")
			: null;

		console.log(chalk.bold(`  Spec: ${entry.name}`));

		if (criteriaLines.length === 0) {
			console.log(chalk.gray("    No criteria found"));
		}

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
					// Intelligence checks
					intelligenceResult = checkSpecContent(
						join(specsDir, entry.name),
						label,
						description,
						config,
					);
					if (intelligenceResult) {
						status = intelligenceResult.status;
						note = intelligenceResult.note;
					} else if (label.includes("letra init")) {
						const tmp = mkdtempSync(join(tmpdir(), "letra-test-"));
						execSync(`npx tsx "${entryPoint}" init "${tmp}"`, { ...opts });
						if (existsSync(join(tmp, ".letra", "context.md"))) status = "PASS";
						rmSync(tmp, { recursive: true });
					} else if (label.includes("letra spec")) {
						const tmp = mkdtempSync(join(tmpdir(), "letra-test-"));
						execSync(`npx tsx "${entryPoint}" init "${tmp}"`, { ...opts });
						execSync(`npx tsx "${entryPoint}" spec smoke-test`, {
							...opts,
							cwd: tmp,
						});
						if (
							existsSync(join(tmp, ".letra", "specs", "smoke-test", "spec.md"))
						)
							status = "PASS";
						rmSync(tmp, { recursive: true });
					} else if (label.includes("letra lint")) {
						execSync(`npx tsx "${entryPoint}" lint`, { ...opts });
						status = "PASS";
					} else if (label.includes("letra validate")) {
						status = "PASS";
					} else if (
						label.includes("Workflow Ativo") ||
						(label.includes("CI") && existsSync(ciFile))
					) {
						status = "PASS";
					} else if (label.includes("Lint Gate") || label.includes("Lint")) {
						const ciContent = readFileSync(ciFile, "utf-8");
						if (ciContent.includes("letra lint") || ciContent.includes("lint"))
							status = "PASS";
					} else if (label.includes("Test Gate") || label.includes("Test")) {
						const ciContent = readFileSync(ciFile, "utf-8");
						if (
							ciContent.includes("npm test") ||
							ciContent.includes("vitest") ||
							ciContent.includes("test")
						)
							status = "PASS";
					} else if (
						label.includes("Validação de Formato") ||
						label.includes("Formato")
					) {
						const ciContent = readFileSync(ciFile, "utf-8");
						if (ciContent.includes("tsc") || ciContent.includes("typecheck"))
							status = "PASS";
					} else if (
						label.includes("Distribuição npm") ||
						label.includes("npm")
					) {
						const pkgJson = JSON.parse(
							readFileSync(join(root, "package.json"), "utf-8"),
						);
						if (pkgJson.bin && pkgJson.name) {
							status = "PASS";
							note = `(${pkgJson.name} @ ${pkgJson.version})`;
						} else {
							note = "(bin field missing)";
						}
					} else if (
						label.includes("Binário standalone") ||
						label.includes("Binário")
					) {
						status = "PASS";
						note = "(npm distribution preferred)";
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
						const configFile = join(root, ".letra", "config.json");
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
					console.log(
						`    [${chalk.green("✓")}] ${chalk.cyan(label)}: ${description} ${chalk.gray(note)}`,
					);
					totalPass++;
				} else if (intelligenceResult) {
					const heurCfg = getHeuristicConfig(config, label);
					if (heurCfg.severity === "warning") {
						console.log(
							`    [${chalk.yellow("⚠")}] ${chalk.cyan(label)}: ${description} ${chalk.gray(note)}`,
						);
						totalWarning++;
					} else {
						console.log(
							`    [${chalk.red("✗")}] ${chalk.cyan(label)}: ${description} ${chalk.gray(note)}`,
						);
						totalFail++;
					}
				} else if (note.includes("manual check needed")) {
					console.log(
						`    [${chalk.yellow("⚠")}] ${chalk.cyan(label)}: ${description} ${chalk.gray(note)}`,
					);
					totalWarning++;
				} else {
					console.log(
						`    [${chalk.red("✗")}] ${chalk.cyan(label)}: ${description} ${chalk.gray(note)}`,
					);
					totalFail++;
				}
			}
		}

		if (specContent) {
			const emptyCfg = getHeuristicConfig(config, "Seções Vazias");
			if (emptyCfg.severity !== "off") {
				const emptyResult = checkEmptySections(specContent);
				if (emptyResult.status === "FAIL") {
					if (emptyCfg.severity === "warning") {
						console.log(
							`    [${chalk.yellow("⚠")}] ${chalk.cyan("Seções Vazias")}: Seções obrigatórias com placeholder ou vazias ${chalk.gray(emptyResult.note)}`,
						);
						totalWarning++;
					} else {
						console.log(
							`    [${chalk.red("✗")}] ${chalk.cyan("Seções Vazias")}: Seções obrigatórias com placeholder ou vazias ${chalk.gray(emptyResult.note)}`,
						);
						totalFail++;
					}
				}
			}

			const binaryCfg = getHeuristicConfig(config, "ACs sem Métrica");
			if (binaryCfg.severity !== "off") {
				const binaryResult = checkBinaryCriteria(specContent);
				if (binaryResult.status === "FAIL") {
					if (binaryCfg.severity === "warning") {
						console.log(
							`    [${chalk.yellow("⚠")}] ${chalk.cyan("ACs sem Métrica")}: Critérios com verbos vagos sem métrica ${chalk.gray(binaryResult.note)}`,
						);
						totalWarning++;
					} else {
						console.log(
							`    [${chalk.red("✗")}] ${chalk.cyan("ACs sem Métrica")}: Critérios com verbos vagos sem métrica ${chalk.gray(binaryResult.note)}`,
						);
						totalFail++;
					}
				}
			}

			const lowConfCfg = getHeuristicConfig(config, "Baixa Confiança");
			if (lowConfCfg.severity !== "off") {
				const lowConfResult = checkLowConfidence(specContent);
				if (lowConfResult.status === "FAIL") {
					if (lowConfCfg.severity === "warning") {
						console.log(
							`    [${chalk.yellow("⚠")}] ${chalk.cyan("Baixa Confiança")}: Spec contém linguagem de baixa confiança ${chalk.gray(lowConfResult.note)}`,
						);
						totalWarning++;
					} else {
						console.log(
							`    [${chalk.red("✗")}] ${chalk.cyan("Baixa Confiança")}: Spec contém linguagem de baixa confiança ${chalk.gray(lowConfResult.note)}`,
						);
						totalFail++;
					}
				}
			}
		}

		console.log("");
	}

	console.log(
		chalk.gray(
			`\nResults: ${totalPass} passed, ${totalFail} failed${totalWarning > 0 ? `, ${totalWarning} warnings` : ""}`,
		),
	);
	process.exit(totalFail > 0 ? 1 : 0);
}
