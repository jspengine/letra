import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";
import { getLetraDir } from "./../../workspace/resolver.js";

const STALE_AC_PATTERN = /-\s\[ \]\s\*\*`([^`]+)`\*\*/g;
const DONE_AC_PATTERN = /-\s\[x\]\s\*\*`([^`]+)`\*\*/g;

export const stageDriftDetector: Detector = {
	name: "stage-drift",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const workflowFile = join(getLetraDir(rootDir), "workflow.json");

		if (!existsSync(workflowFile)) return results;

		const workflow = JSON.parse(readFileSync(workflowFile, "utf-8"));
		const items = workflow.items || [];
		const stages = workflow.stages || [];

		const doneStageIds = stages
			.filter((s: { zone?: string }) => s.zone === "done")
			.map((s: { id: string }) => s.id);
		const reviewStageIds = stages
			.filter(
				(s: { name?: string; id: string }) =>
					s.name?.toLowerCase() === "review" || s.id === "review",
			)
			.map((s: { id: string }) => s.id);

		for (const item of items) {
			if (!item.spec) continue;
			const specDir = join(getLetraDir(rootDir), "specs", item.spec);
			const specFile = join(specDir, "spec.md");
			if (!existsSync(specFile)) continue;

			const content = readFileSync(specFile, "utf-8");
			const staleMatches = [...content.matchAll(STALE_AC_PATTERN)];
			const doneMatches = [...content.matchAll(DONE_AC_PATTERN)];
			const totalACs = staleMatches.length + doneMatches.length;
			if (totalACs === 0) continue;

			const pctDone = doneMatches.length / totalACs;
			const isInReview = reviewStageIds.includes(item.stage);
			const isInBacklog = item.stage === "backlog";

			if (pctDone === 1 && (isInReview || isInBacklog)) {
				results.push({
					id: `stage-drift_${item.id}`,
					type: "info",
					title: `${item.id} (${item.description}) — 100% ACs prontos`,
					description: `O item ${item.id} (${item.description}) tem ${doneMatches.length}/${totalACs} ACs implementados. Está em "${item.stage}" mas deveria estar em "done".`,
					certainty: 0.85,
					detector: "stage-drift",
					autoFix: async () => {
						const before = readFileSync(workflowFile, "utf-8");
						const newWorkflow = JSON.parse(before);
						const target = newWorkflow.items.find(
							(i: { id: string }) => i.id === item.id,
						);
						if (target) {
							target.stage = doneStageIds[0] || "done";
							target.updatedAt = new Date().toISOString();
						}
						const after = JSON.stringify(newWorkflow, null, 2);
						return {
							files: [{ path: ".letra/workflow.json", before, after }],
							snapshotId: "",
						};
					},
				});
			} else if (pctDone > 0 && pctDone < 1 && isInBacklog) {
				const doingStage =
					stages.find((s: { zone?: string }) => s.zone === "doing") ??
					stages.find((_s: unknown, i: number) => i > 0);
				const stageHint = doingStage
					? `"${doingStage.name || doingStage.id}"`
					: "o próximo estágio";
				results.push({
					id: `stage-drift_${item.id}_partial`,
					type: "info",
					title: `${item.id} (${item.description}) — ${doneMatches.length}/${totalACs} ACs prontos`,
					description: `O item ${item.id} tem ${doneMatches.length}/${totalACs} ACs implementados mas está em backlog. Considere mover para ${stageHint}.`,
					certainty: 0.7,
					detector: "stage-drift",
				});
			}
		}

		return results;
	},
};
