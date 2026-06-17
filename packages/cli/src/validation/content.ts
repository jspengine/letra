import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type Config, getHeuristicConfig, loadConfig } from "../config.js";

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

	if (!existsSync(specFile)) return { status: "FAIL" as const, note: "(spec.md not found)" };

	const specContent = readFileSync(specFile, "utf-8");
	const now = new Date();

	if (label.includes("Conteúdo Mínimo")) {
		const outcomeMatch = specContent.match(/## Outcome\s+([\s\S]*?)(?=\n## )/);
		if (!outcomeMatch) return { status: "FAIL" as const, note: "(no Outcome section)" };
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

	if (label.includes("Consistência de Terminologia") || label.includes("Terminologia")) {
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

	if (label.includes("Detecção de Tom") || label.includes("Tom")) {
		const lowerSpec = specContent.toLowerCase();
		const words = lowerSpec.split(/\s+/);
		const heurConfig = getHeuristicConfig(cfg, label);
		const blacklist = heurConfig.blacklist ?? [
			"tipo",
			"tá",
			"pra",
			"blz",
			"kkk",
			"eita",
			"oi",
			"oi pessoal",
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

	if (label.includes("Drift Temporal") || label.includes("Temporal")) {
		const stat = statSync(specFile);
		const daysOld = Math.floor((now.getTime() - stat.mtimeMs) / (1000 * 60 * 60 * 24));
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
	const acMatch = specContent.match(/## Acceptance Criteria\s+([\s\S]*?)(?=\n## |\n*$)/);
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
		const hasVagueVerb = vagueVerbs.some((v) => description.toLowerCase().includes(v));
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

const commonWords = [
	"para", "com", "que", "dos", "das", "uma", "como", "mais", "mas",
	"por", "pode", "ser", "são", "tem", "seu", "sua", "esta", "este",
	"isso", "the", "and", "for", "with", "that", "this", "from", "are",
	"was",
];

function getSignificantWords(text: string): string[] {
	return text
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length >= 4 && !commonWords.includes(w));
}

function getPrefix(name: string): string {
	const idx = name.indexOf("-");
	return idx === -1 ? name : name.slice(0, idx);
}

function isSibling(nameA: string, nameB: string): boolean {
	return getPrefix(nameA) === getPrefix(nameB);
}

function detectConflict(textA: string, textB: string): boolean {
	const lowerA = textA.toLowerCase();
	const lowerB = textB.toLowerCase();

	const aHasNeg = /\bn[ãa]o\b/.test(lowerA) || /\bnot\b/.test(lowerA);
	const bHasNeg = /\bn[ãa]o\b/.test(lowerB) || /\bnot\b/.test(lowerB);

	if (aHasNeg !== bHasNeg) {
		const wordsA = getSignificantWords(lowerA);
		const wordsB = getSignificantWords(lowerB);
		const intersection = wordsA.filter((w) => wordsB.includes(w));
		const maxLen = Math.max(wordsA.length, wordsB.length);
		if (maxLen > 0 && intersection.length / maxLen > 0.6) return true;
	}

	const apenasA = lowerA.match(/(?:apenas|only)\s+(\w+)/);
	const apenasB = lowerB.match(/(?:apenas|only)\s+(\w+)/);

	if (apenasA && !apenasB) {
		const termA = apenasA[1];
		const wordsA = getSignificantWords(lowerA);
		const wordsB = getSignificantWords(lowerB);
		const shared = wordsA.filter((w) => w !== termA && wordsB.includes(w));
		if (shared.length > 0 && !wordsB.includes(termA)) return true;
	}
	if (apenasB && !apenasA) {
		const termB = apenasB[1];
		const wordsA = getSignificantWords(lowerA);
		const wordsB = getSignificantWords(lowerB);
		const shared = wordsB.filter((w) => w !== termB && wordsA.includes(w));
		if (shared.length > 0 && !wordsA.includes(termB)) return true;
	}
	if (apenasA && apenasB && apenasA[1] !== apenasB[1]) {
		const wordsA = getSignificantWords(lowerA);
		const wordsB = getSignificantWords(lowerB);
		const shared = wordsA.filter((w) => wordsB.includes(w));
		if (shared.length > 0) return true;
	}

	return false;
}

export function checkConflicts(
	specsDir: string,
	config: Config,
): { label: string; passed: boolean; message: string }[] {
	const results: { label: string; passed: boolean; message: string }[] = [];
	const entries = readdirSync(specsDir, { withFileTypes: true });
	const specDirs = entries
		.filter((e) => e.isDirectory() && !e.name.startsWith("_"))
		.map((e) => e.name);

	const specs: { name: string; acs: string[] }[] = [];
	for (const dir of specDirs) {
		const acceptanceFile = join(specsDir, dir, "acceptance.md");
		if (!existsSync(acceptanceFile)) continue;
		const content = readFileSync(acceptanceFile, "utf-8");
		const acLines = content.match(/- \[[ x]\] \*\*(.+?)\*\*: (.+)/g) || [];
		const acs = acLines
			.map((line) => {
				const m = line.match(/- \[[ x]\] \*\*(.+?)\*\*: (.+)/);
				return m ? m[2].trim() : "";
			})
			.filter(Boolean);
		if (acs.length > 0) specs.push({ name: dir, acs });
	}

	for (let i = 0; i < specs.length; i++) {
		for (let j = i + 1; j < specs.length; j++) {
			const a = specs[i];
			const b = specs[j];
			if (isSibling(a.name, b.name)) continue;

			for (const acA of a.acs) {
				for (const acB of b.acs) {
					if (detectConflict(acA, acB)) {
						results.push({
							label: "Validate Conflict",
							passed: false,
							message: `Conflito: "${a.name}" AC "${acA}" vs "${b.name}" AC "${acB}"`,
						});
					}
				}
			}
		}
	}

	if (results.length === 0) {
		results.push({
			label: "Validate Conflict",
			passed: true,
			message: "Nenhum conflito detectado entre specs",
		});
	}

	return results;
}
