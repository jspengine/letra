import { resolve } from "node:path";
import { Command } from "commander";
import { buildActivityContext } from "../activity-context/index.js";
import type { ActivityContext, ActivityKind } from "../activity-context/index.js";

function renderText(context: ActivityContext): string {
	const lines: string[] = [];

	lines.push(`# Activity Context: ${context.activity}`);
	lines.push("");
	lines.push(`Objective: ${context.objective}`);

	if (context.currentItem) {
		lines.push(`Item: ${context.currentItem.id} — ${context.currentItem.description}`);
		lines.push(`Stage: ${context.currentItem.stageName}`);
		if (context.currentItem.spec) {
			lines.push(`Spec: ${context.currentItem.spec}`);
		}
		if (context.currentItem.acs.total > 0) {
			lines.push(
				`ACs: ${context.currentItem.acs.pending}/${context.currentItem.acs.total} pendentes`,
			);
		}
	} else {
		lines.push("Item: nenhum item ativo");
	}

	lines.push("");
	lines.push("Must Read:");
	for (const reference of context.mustRead) {
		lines.push(`- ${reference.path} — ${reference.reason}`);
	}

	lines.push("");
	lines.push("Must Not Do:");
	for (const item of context.mustNotDo) {
		lines.push(`- ${item}`);
	}

	lines.push("");
	lines.push("Next Actions:");
	for (const action of context.nextActions) {
		lines.push(`- ${action.label}: ${action.description}`);
	}

	if (context.risks.length > 0) {
		lines.push("");
		lines.push("Risks:");
		for (const risk of context.risks) {
			lines.push(`- [${risk.level}] ${risk.message}`);
		}
	}

	if (context.signals.length > 0) {
		lines.push("");
		lines.push("Signals:");
		for (const signal of context.signals) {
			lines.push(`- [${signal.level}] ${signal.code}: ${signal.message}`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

export default function activityContextCommand() {
	return new Command("activity-context")
		.description("Build situational context for the current workspace activity")
		.option(
			"--activity <kind>",
			"Activity kind: design, implement, review, diagnose, gate",
			"implement",
		)
		.option("--format <type>", "Output format: text or json", "text")
		.action((options: { activity?: string; format?: string }) => {
			const activity = (options.activity || "implement") as ActivityKind;
			const format = options.format || "text";
			const root = resolve(process.cwd());
			const context = buildActivityContext({ activity, workspaceRoot: root });

			if (format === "json") {
				console.log(JSON.stringify(context, null, 2));
				return;
			}

			console.log(renderText(context));
		});
}

export { renderText };
