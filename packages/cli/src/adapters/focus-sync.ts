import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Workflow } from "../commands/flow-init.js";
import { getLetraDir } from "./../workspace/resolver.js";

export interface FocusData {
	specName: string;
	itemId: string;
	outcome: string;
}

export interface FocusRecommendedAction {
	command: string;
	label: string;
	description?: string;
}

export function syncFocus(
	rootDir: string,
	workflow: Workflow | null,
	recommendedActions: FocusRecommendedAction[] = [],
): { cleared: boolean; generated: boolean; diverged: boolean } {
	const focusFile = join(getLetraDir(rootDir), "focus.md");
	const focusData = readFocusFile(rootDir);
	let cleared = false;
	let generated = false;
	let diverged = false;

	if (focusData && workflow) {
		const itemExists = workflow.items.some((i) => i.id === focusData.itemId);
		if (!itemExists) {
			clearFocusFile(rootDir);
			cleared = true;
		} else {
			const item = workflow.items.find((i) => i.id === focusData.itemId);
			if (item && item.spec && item.spec !== focusData.specName) {
				diverged = true;
			}
		}
	}

	if (!focusData && workflow) {
		const activeItem = findActiveItem(workflow);
		if (activeItem?.spec) {
			writeFocusFile(rootDir, activeItem.spec, activeItem.id, recommendedActions);
			generated = true;
		}
	}

	if (focusData && !workflow) {
		clearFocusFile(rootDir);
		cleared = true;
	}

	return { cleared, generated, diverged };
}

function findActiveItem(workflow: Workflow) {
	const activeStages = workflow.stages
		.filter((s) => s.zone === "doing" || (!s.zone && s.order > 0 && s.order < workflow.stages.length - 1))
		.map((s) => s.id);
	const stageSet = new Set(activeStages);
	if (stageSet.size === 0) {
		const mid = Math.floor(workflow.stages.length / 2);
		const stage = workflow.stages[mid];
		if (stage) stageSet.add(stage.id);
	}
	const items = workflow.items.filter((i) => stageSet.has(i.stage));
	if (items.length === 0) return null;
	return items.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b);
}

export function extractOutcome(rootDir: string, specName: string): string | null {
	const specFile = join(getLetraDir(rootDir), "specs", specName, "spec.md");
	if (!existsSync(specFile)) return null;
	const content = readFileSync(specFile, "utf-8");
	const match = content.match(/## Outcome\s+([\s\S]*?)(?=\n## |\n*$)/);
	return match ? match[1].trim() : null;
}

export function writeFocusFile(
	rootDir: string,
	specName: string,
	itemId: string,
	recommendedActions: FocusRecommendedAction[] = [],
): void {
	const focusFile = join(getLetraDir(rootDir), "focus.md");
	const outcome = extractOutcome(rootDir, specName) || specName;
	const letraDir = getLetraDir(rootDir);
	const content = [
		`# Focus: ${specName}`,
		"",
		`**Path**: .letra/specs/${specName}/`,
		`**Item**: ${itemId}`,
		`**Outcome**: ${outcome}`,
		"",
		...(recommendedActions.length > 0
			? [
					"## Ações Recomendadas",
					"",
					...recommendedActions.map((action) => {
						const detail = action.description
							? `${action.label}: ${action.description}`
							: action.label;
						return `- \`${action.command}\` — ${detail}`;
					}),
					"",
				]
			: []),
		"## Links",
		"",
		`- [Spec: ${specName}](${pathToFileURL(join(letraDir, "specs", specName, "spec.md")).href})`,
		`- [${itemId}](${pathToFileURL(join(letraDir, "workflow.json")).href})`,
		`- [Constitution](${pathToFileURL(join(letraDir, "constitution.md")).href})`,
		`- [Constraints](${pathToFileURL(join(letraDir, "constraints.md")).href})`,
		"",
	].join("\n");

	writeFileSync(focusFile, content, "utf-8");
}

export function clearFocusFile(rootDir: string): void {
	const focusFile = join(getLetraDir(rootDir), "focus.md");
	if (existsSync(focusFile)) {
		unlinkSync(focusFile);
	}
}

export function readFocusFile(rootDir: string): FocusData | null {
	const focusFile = join(getLetraDir(rootDir), "focus.md");
	if (!existsSync(focusFile)) return null;

	const content = readFileSync(focusFile, "utf-8");
	const specMatch = content.match(/# Focus:\s*(.+)/);
	const itemMatch = content.match(/\*\*Item\*\*:\s*(.+)/);
	const outcomeMatch = content.match(/\*\*Outcome\*\*:\s*([\s\S]*?)(?=\n\*\*|\n## |\n*$)/);

	if (!specMatch) return null;

	return {
		specName: specMatch[1].trim(),
		itemId: itemMatch ? itemMatch[1].trim() : "",
		outcome: outcomeMatch ? outcomeMatch[1].trim() : "",
	};
}
