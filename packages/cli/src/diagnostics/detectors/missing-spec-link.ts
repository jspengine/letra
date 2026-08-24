import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";
import { getLetraDir } from "./../../workspace/resolver.js";

export const missingSpecLinkDetector: Detector = {
	name: "missing-spec-link",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const workflowFile = join(getLetraDir(rootDir), "workflow.json");
		if (!existsSync(workflowFile)) return results;

		const workflow = JSON.parse(readFileSync(workflowFile, "utf-8"));
		const items = workflow.items || [];
		const stages = workflow.stages || [];
		const specLinks = workflow.specLinks || {};

		const backlogStageIds = new Set(
			stages
				.filter(
					(s: { id: string; zone?: string }) => s.zone === "todo" || s.id === "backlog",
				)
				.map((s: { id: string }) => s.id),
		);

		for (const item of items) {
			if (backlogStageIds.has(item.stage)) continue;

			if (!item.spec) {
				results.push({
					id: `missing-spec-link_${item.id}`,
					type: "info",
					title: `${item.id}: sem spec linkada`,
					description: `O item ${item.id} (${item.description}) está em "${item.stage}" mas não tem spec associada. Link usando: letra flow edit ${item.id} --spec <nome>`,
					certainty: 0.9,
					detector: "missing-spec-link",
					autoFix: async () => {
						const kebab = item.description
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, "-")
							.replace(/^-|-$/g, "");

						const specsDir = join(getLetraDir(rootDir), "specs");
						if (!existsSync(specsDir)) return { files: [], snapshotId: "no-op" };

						const specDirs = readdirSync(specsDir, { withFileTypes: true })
							.filter((d) => d.isDirectory())
							.map((d) => d.name);

						const exact = specDirs.find((d) => d === kebab);
						if (exact) {
							const before = readFileSync(workflowFile, "utf-8");
							const wf = JSON.parse(before);
							const target = wf.items.find((i: { id: string }) => i.id === item.id);
							if (target) {
								target.spec = exact;
								if (!wf.specLinks) wf.specLinks = {};
								wf.specLinks[exact] = { path: `.letra/specs/${exact}/spec.md` };
								wf.updatedAt = new Date().toISOString();
								return {
									files: [
										{
											path: ".letra/workflow.json",
											before,
											after: JSON.stringify(wf, null, 2),
										},
									],
									snapshotId: "auto-fix",
								};
							}
						}

						const partial = specDirs.find(
							(d) => kebab.includes(d) || d.includes(kebab),
						);
						if (partial) {
							const before = readFileSync(workflowFile, "utf-8");
							const wf = JSON.parse(before);
							const target = wf.items.find((i: { id: string }) => i.id === item.id);
							if (target) {
								target.spec = partial;
								if (!wf.specLinks) wf.specLinks = {};
								wf.specLinks[partial] = { path: `.letra/specs/${partial}/spec.md` };
								wf.updatedAt = new Date().toISOString();
								return {
									files: [
										{
											path: ".letra/workflow.json",
											before,
											after: JSON.stringify(wf, null, 2),
										},
									],
									snapshotId: "auto-fix",
								};
							}
						}

						return { files: [], snapshotId: "no-op" };
					},
				});
				continue;
			}

			const specPath = join(getLetraDir(rootDir), "specs", item.spec, "spec.md");
			if (!existsSync(specPath)) {
				results.push({
					id: `missing-spec-link_${item.id}_notfound`,
					type: "warning",
					title: `${item.id}: spec linkada não encontrada em disco`,
					description: `Item ${item.id} referencia spec "${item.spec}" mas ${specPath} não existe.`,
					certainty: 0.9,
					detector: "missing-spec-link",
				});
				continue;
			}

			if (!specLinks[item.spec]) {
				results.push({
					id: `missing-spec-link_${item.id}_unregistered`,
					type: "info",
					title: `${item.id}: spec não registrada em specLinks`,
					description: `Item ${item.id} tem spec="${item.spec}" mas specLinks não contém entrada para "${item.spec}".`,
					certainty: 0.7,
					detector: "missing-spec-link",
				});
			}
		}

		return results;
	},
};
