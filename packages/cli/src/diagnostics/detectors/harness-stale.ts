import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adapterDiagnosticFiles } from "../../adapters/registry.js";
import type { Detector, DiagnosticResult } from "../types.js";
import { getLetraDir } from "./../../workspace/resolver.js";

const ADAPTER_FILES = adapterDiagnosticFiles();
const BOOTSTRAP_MARKERS = ["# Letra Agent Bootstrap", "letra direction --json"];

export const harnessStaleDetector: Detector = {
	name: "harness-stale",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const workflowFile = join(getLetraDir(rootDir), "workflow.json");

		let tools: string[] = ["cursor", "opencode", "vscode"];
		let workflow:
			| {
					name: string;
					stages: { id: string; name: string; zone?: string }[];
					items: {
						id: string;
						description: string;
						stage: string;
						spec?: string;
						tasks?: { id: string; description: string; done: boolean }[];
					}[];
			  }
			| undefined;
		if (existsSync(workflowFile)) {
			try {
				const wf = JSON.parse(readFileSync(workflowFile, "utf-8"));
				if (Array.isArray(wf.tools)) {
					tools = wf.tools;
				}
				workflow = wf;
			} catch {}
		}

		const staleTools: string[] = [];
		for (const tool of tools) {
			const info = ADAPTER_FILES[tool];
			if (!info) continue;

			const filePath = join(rootDir, info.path);
			if (!existsSync(filePath)) continue;

			// Current adapters are the stable bootstrap that sends agents to the
			// live direction. The old L1 references (.letra/context.md) are no
			// longer generated, so checking them flagged every fresh adapter and
			// the autoFix could never clear the alert.
			const content = readFileSync(filePath, "utf-8");
			const isStale = !BOOTSTRAP_MARKERS.every((marker) => content.includes(marker));

			if (isStale) staleTools.push(tool);
		}

		if (staleTools.length > 0) {
			const doneStageIds = new Set(
				(workflow?.stages || [])
					.filter((s) => s.id === "done" || s.zone === "done")
					.map((s) => s.id),
			);
			const backlogStageIds = new Set(
				(workflow?.stages || [])
					.filter((s) => s.id === "backlog" || s.zone === "todo")
					.map((s) => s.id),
			);
			let activeStageId: string | undefined;
			let primaryItemId: string | undefined;
			if (workflow) {
				const activeItem = workflow.items.find(
					(i) => !doneStageIds.has(i.stage) && !backlogStageIds.has(i.stage),
				);
				if (activeItem) {
					activeStageId = activeItem.stage;
					primaryItemId = activeItem.id;
				}
			}

			results.push({
				id: "harness-stale_all",
				type: "info",
				title: `Adaptadores desatualizados: ${staleTools.join(", ")}`,
				description: `Regenerando ${staleTools.length} adaptador(es) sem o bootstrap de direção viva.`,
				certainty: 1.0,
				detector: "harness-stale",
				autoFix: async () => {
					const files: { path: string; before: string; after: string }[] = [];
					for (const tool of staleTools) {
						const info = ADAPTER_FILES[tool];
						if (!info) continue;
						const fp = join(rootDir, info.path);
						if (existsSync(fp)) {
							files.push({
								path: info.path.replace(/\\/g, "/"),
								before: readFileSync(fp, "utf-8"),
								after: "",
							});
						}
					}

					const { generateAdapters } = await import("../../adapters/generate.js");
					generateAdapters(rootDir, tools, {
						source: "flow-move",
						workflow,
						activeStageId,
						primaryItemId,
						quiet: true,
						verb: "Updated",
					});

					for (const file of files) {
						file.after = readFileSync(join(rootDir, file.path), "utf-8");
					}

					return { files, snapshotId: "" };
				},
			});
		}

		return results;
	},
};
