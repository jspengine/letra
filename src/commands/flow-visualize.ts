import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow } from "./flow-init.js";
import type { Workflow } from "./flow-init.js";

function generateMermaid(workflow: Workflow): string {
	const sorted = [...workflow.stages].sort((a, b) => a.order - b.order);

	const itemsByStage = new Map<string, number>();
	for (const item of workflow.items) {
		itemsByStage.set(item.stage, (itemsByStage.get(item.stage) ?? 0) + 1);
	}

	function labelFor(stage: (typeof sorted)[number]): string {
		const count = itemsByStage.get(stage.id) ?? 0;
		return `${stage.name} (${count} ${count === 1 ? "item" : "items"})`;
	}

	const lines: string[] = ["flowchart LR"];

	if (sorted.length === 0) return lines.join("\n");
	if (sorted.length === 1) {
		lines.push(`  ${sorted[0].id}["${labelFor(sorted[0])}"]`);
		return lines.join("\n");
	}

	lines.push(
		`  ${sorted[0].id}["${labelFor(sorted[0])}"] --> ${sorted[1].id}["${labelFor(sorted[1])}"]`,
	);

	for (let i = 1; i < sorted.length - 1; i++) {
		lines.push(
			`  ${sorted[i].id} --> ${sorted[i + 1].id}["${labelFor(sorted[i + 1])}"]`,
		);
	}

	return lines.join("\n");
}

export function flowVisualize(
	root: string,
	options?: { output?: string },
): void {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(
			chalk.yellow("No workflow found. Run 'letra flow init --quick' first"),
		);
		return;
	}

	const mermaid = generateMermaid(workflow);

	if (options?.output) {
		const outputPath = resolve(root, options.output);
		writeFileSync(outputPath, `${mermaid}\n`);
		console.log(`Diagram saved to ${options.output}`);
	} else {
		console.log(mermaid);
	}
}

export function flowVisualizeAction(
	targetPath: string | undefined,
	options?: { output?: string },
): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowVisualize(root, options);
}
