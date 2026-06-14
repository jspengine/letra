import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import { loadWorkflow } from "./flow-init.js";
import type { Workflow } from "./flow-init.js";

const MERMAID_LIVE = "https://mermaid.live/edit#";

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
		lines.push(`  ${sorted[i].id} --> ${sorted[i + 1].id}["${labelFor(sorted[i + 1])}"]`);
	}

	return lines.join("\n");
}

function mermaidUrl(code: string): string {
	return `${MERMAID_LIVE}?code=${encodeURIComponent(code)}`;
}

function buildHtml(mermaid: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Workflow Diagram</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>
  body { font-family: system-ui, sans-serif; max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
  .mermaid { text-align: center; }
</style>
</head>
<body>
<pre class="mermaid">
${mermaid}
</pre>
<script>mermaid.initialize({ startOnLoad: true });</script>
</body>
</html>`;
}

export function flowVisualize(root: string, options?: { output?: string }): void {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.yellow("No workflow found. Run 'letra flow init --quick' first"));
		return;
	}

	const mermaid = generateMermaid(workflow);

	if (options?.output) {
		const outputPath = resolve(root, options.output);
		const ext = options.output.toLowerCase().split(".").pop();

		let content: string;
		let label: string;

		if (ext === "html") {
			content = buildHtml(mermaid);
			label = "HTML page";
		} else if (ext === "md") {
			content = `\`\`\`mermaid\n${mermaid}\n\`\`\`\n`;
			label = "Markdown file";
		} else {
			content = `${mermaid}\n`;
			label = "Diagram file";
		}

		writeFileSync(outputPath, content);
		console.log(`${label} saved to ${options.output}`);
	} else {
		console.log(mermaid);
		console.log(chalk.dim(`\nCopy to ${MERMAID_LIVE} to render`));
	}
}

export function flowVisualizeAction(
	targetPath: string | undefined,
	options?: { output?: string },
): void {
	const root = resolve(process.cwd(), targetPath || ".");
	flowVisualize(root, options);
}
