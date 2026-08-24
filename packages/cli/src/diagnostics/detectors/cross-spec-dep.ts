import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Detector, DiagnosticResult } from "../types.js";
import { getLetraDir } from "./../../workspace/resolver.js";

const ITEM_REF_PATTERN = /\bITEM-\d+\b/g;
const API_REF_PATTERN = /\/api\/[a-z][a-z-\/]*(?=["\s)])/gi;
const UPDATED_PATTERN = /^>\s*Updated:\s*(.+)/m;

export const crossSpecDepDetector: Detector = {
	name: "cross-spec-dep",
	async run(rootDir: string): Promise<DiagnosticResult[]> {
		const results: DiagnosticResult[] = [];
		const specsDir = join(getLetraDir(rootDir), "specs");
		if (!existsSync(specsDir)) return results;

		const specs = new Map<string, { content: string; updatedAt: string }>();
		const itemToSpec = loadItemToSpec(join(getLetraDir(rootDir), "workflow.json"));

		const dirs = readdirSync(specsDir, { withFileTypes: true }).filter(
			(d) => d.isDirectory() && !d.name.startsWith("_"),
		);

		for (const dir of dirs) {
			const specFile = join(specsDir, dir.name, "spec.md");
			if (!existsSync(specFile)) continue;
			const content = readFileSync(specFile, "utf-8");
			const updated = content.match(UPDATED_PATTERN);
			specs.set(dir.name, {
				content,
				updatedAt: updated ? updated[1].trim() : "",
			});
		}

		for (const [name, spec] of specs) {
			const refs = findReferences(name, spec.content, specs, itemToSpec);
			for (const ref of refs) {
				const target = specs.get(ref);
				if (!target || !target.updatedAt || !spec.updatedAt) continue;
				if (target.updatedAt <= spec.updatedAt) continue;

				results.push({
					id: `cross-spec-dep_${name}_refs_${ref}`,
					type: "warning",
					title: `Spec "${name}" referencia "${ref}" que foi atualizado depois`,
					description: `"${ref}" foi atualizado em ${target.updatedAt}, mas "${name}" (que o referencia) parou em ${spec.updatedAt}. Pode haver drift. Revise "${name}" para compatibilidade.`,
					certainty: 0.6,
					detector: "cross-spec-dep",
				});
			}
		}

		return results;
	},
};

function loadItemToSpec(workflowPath: string): Map<string, string> {
	const map = new Map<string, string>();
	try {
		const wf = JSON.parse(readFileSync(workflowPath, "utf-8"));
		if (wf.items) {
			for (const item of wf.items) {
				if (item.id && item.spec) {
					map.set(item.id, item.spec);
				}
			}
		}
	} catch {}
	return map;
}

function findReferences(
	specName: string,
	content: string,
	allSpecs: Map<string, { content: string; updatedAt: string }>,
	itemToSpec: Map<string, string>,
): string[] {
	const refs = new Set<string>();

	const itemMatches = content.matchAll(ITEM_REF_PATTERN);
	for (const m of itemMatches) {
		const spec = itemToSpec.get(m[0]);
		if (spec && spec !== specName) {
			refs.add(spec);
		}
	}

	const apiMatches = content.matchAll(API_REF_PATTERN);
	for (const m of apiMatches) {
		const apiPath = m[0].replace(/["\s]+$/, "").toLowerCase();
		for (const [otherName, otherSpec] of allSpecs) {
			if (otherName === specName) continue;
			if (otherSpec.content.toLowerCase().includes(apiPath)) {
				refs.add(otherName);
			}
		}
	}

	for (const [otherName] of allSpecs) {
		if (otherName === specName) continue;
		const escapedName = otherName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
		const namePattern = new RegExp(`\\b${escapedName}\\b`, "i");
		if (namePattern.test(content)) {
			refs.add(otherName);
		}
	}

	return [...refs];
}
