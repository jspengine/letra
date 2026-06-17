import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow, writeWorkflow } from "./flow-init.js";
import { logEntry } from "../session-log.js";

function findACLine(lines: string[], n: number): number | null {
	let count = 0;
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (/^- \[ \]/.test(trimmed)) {
			count++;
			if (count === n) return i;
		}
	}
	return null;
}

export function markAC(root: string, itemId: string, acNum: number): void {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found"));
		process.exit(1);
	}

	const item = workflow.items.find((i) => i.id === itemId);
	if (!item) {
		console.log(chalk.red(`Item ${itemId} not found`));
		process.exit(1);
	}

	if (!item.spec) {
		console.log(chalk.red(`Item ${itemId} has no linked spec`));
		process.exit(1);
	}

	const specDir = join(root, ".letra", "specs", item.spec);
	const specFile = join(specDir, "spec.md");
	if (!existsSync(specFile)) {
		console.log(chalk.red(`Spec file not found: ${specFile}`));
		process.exit(1);
	}

	const content = readFileSync(specFile, "utf-8");
	const lines = content.split("\n");

	const lineIdx = findACLine(lines, acNum);
	if (lineIdx === null) {
		console.log(chalk.red(`AC #${acNum} not found in spec "${item.spec}" (unchecked ACs: ${lines.filter((l) => /^- \[ \]/.test(l.trim())).length})`));
		process.exit(1);
	}

	const orig = lines[lineIdx];
	lines[lineIdx] = orig.replace(/^- \[ \]/, "- [x]");

	writeFileSync(specFile, lines.join("\n"), "utf-8");

	if (workflow.specLinks?.[item.spec]) {
		writeWorkflow(root, { workflow, source: "flow-ac", primaryItemId: item.id, skipSitrep: true, quiet: true });
	}

	logEntry(root, "ac_done", `AC ${acNum} marcado como concluído em ${item.spec}`, {
		itemId: item.id,
		acId: `${acNum}`,
		details: { spec: item.spec },
	});

	console.log(`  ${chalk.green("✓")} AC #${acNum} marcado como concluído em ${chalk.cyan(item.spec)}`);
}

export function flowAcAction(targetPath: string | undefined, itemId: string, acNumber: string): void {
	const root = resolve(process.cwd(), targetPath || ".");
	const n = Number(acNumber);
	if (!Number.isInteger(n) || n < 1) {
		console.log(chalk.red("AC number must be a positive integer"));
		process.exit(1);
	}
	markAC(root, itemId, n);
}
