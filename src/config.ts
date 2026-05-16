import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface HeuristicConfig {
	severity: "error" | "warning" | "off";
	blacklist?: string[];
	minChars?: number;
	maxDays?: number;
}

export interface Config {
	heuristics: Record<string, HeuristicConfig>;
}

const DEFAULT_HEURISTICS: Record<string, HeuristicConfig> = {
	"conteudo-minimo": { severity: "warning", minChars: 50 },
	"consistencia-terminologia": { severity: "warning" },
	"detecao-tom": {
		severity: "warning",
		blacklist: [
			"tipo",
			"tá",
			"pra",
			"blz",
			"kkk",
			"eita",
			"oi",
			"oi pessoal",
		],
	},
	"drift-temporal": { severity: "warning", maxDays: 30 },
	"secoes-vazias": { severity: "warning" },
	"acs-sem-metrica": { severity: "warning" },
	"baixa-confianca": { severity: "warning" },
};

export function loadConfig(root: string): Config {
	const configPath = join(root, ".letra", "config.json");
	const heuristics: Record<string, HeuristicConfig> = {};

	for (const [key, value] of Object.entries(DEFAULT_HEURISTICS)) {
		heuristics[key] = { ...value };
	}

	if (existsSync(configPath)) {
		try {
			const raw = JSON.parse(readFileSync(configPath, "utf-8"));
			if (raw.heuristics && typeof raw.heuristics === "object") {
				for (const [key, value] of Object.entries(raw.heuristics)) {
					if (heuristics[key]) {
						heuristics[key] = {
							...heuristics[key],
							...(value as Partial<HeuristicConfig>),
						};
					} else {
						heuristics[key] = value as HeuristicConfig;
					}
				}
			}
		} catch {
			// Invalid config file, use defaults
		}
	}

	return { heuristics };
}

export function getHeuristicConfig(
	config: Config,
	label: string,
): HeuristicConfig {
	const key = heuristicKey(label);
	return config.heuristics[key] ?? { severity: "warning" };
}

function heuristicKey(label: string): string {
	const lower = label.toLowerCase();

	if (lower.includes("conteudo mínimo") || lower.includes("conteudo minimo"))
		return "conteudo-minimo";
	if (lower.includes("terminologia")) return "consistencia-terminologia";
	if (lower.includes("tom")) return "detecao-tom";
	if (lower.includes("drift temporal") || lower.includes("temporal"))
		return "drift-temporal";
	if (lower.includes("seções vazias") || lower.includes("secoes vazias"))
		return "secoes-vazias";
	if (lower.includes("acs sem métrica") || lower.includes("acs sem metrica"))
		return "acs-sem-metrica";
	if (lower.includes("baixa confiança") || lower.includes("baixa confianca"))
		return "baixa-confianca";

	return lower.replace(/\s+/g, "-");
}
