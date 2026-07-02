import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Workflow } from "../commands/flow-init.js";
import { validateSpecStructure } from "../validation/structure.js";

export interface ResolvedSpec {
	id: string;
	content: string;
}

export function loadResolvedSpecs(root: string, workflow: Workflow | null): ResolvedSpec[] {
	const result: ResolvedSpec[] = [];

	if (workflow?.specLinks) {
		for (const [id, link] of Object.entries(workflow.specLinks)) {
			const filePath = join(root, link.path);
			if (existsSync(filePath)) {
				result.push({ id, content: readFileSync(filePath, "utf-8") });
			}
		}
	}

	const specsDir = join(root, ".letra", "specs");
	const registered = new Set(result.map((entry) => entry.id));
	if (!existsSync(specsDir)) return result;

	for (const entry of readdirSync(specsDir, { withFileTypes: true })) {
		if (!entry.isDirectory() || registered.has(entry.name)) continue;
		const specPath = join(specsDir, entry.name, "spec.md");
		if (!existsSync(specPath)) continue;
		result.push({ id: entry.name, content: readFileSync(specPath, "utf-8") });
	}

	return result;
}

export function readAllowedContextFile(workspaceDir: string, file: string): string | null {
	const allowedFiles = new Set(["context.md", "constitution.md", "glossary.md"]);
	if (!allowedFiles.has(file)) return null;
	const filePath = join(workspaceDir, file);
	if (!existsSync(filePath)) return null;
	return readFileSync(filePath, "utf-8");
}

export function writeSpec(workspaceDir: string, id: string, content: string): void {
	const specDir = join(workspaceDir, "specs", id);
	if (!existsSync(specDir)) mkdirSync(specDir, { recursive: true });
	writeFileSync(join(specDir, "spec.md"), content, "utf-8");
}

export function clearSpec(workspaceDir: string, id: string): void {
	const specFile = join(workspaceDir, "specs", id, "spec.md");
	if (existsSync(specFile)) writeFileSync(specFile, "", "utf-8");
}

export function validateSpec(workspaceDir: string, id: string) {
	const specFile = join(workspaceDir, "specs", id, "spec.md");
	if (!existsSync(specFile)) {
		return {
			id,
			issues: [{ type: "error" as const, msg: "spec.md not found" }],
			valid: false,
		};
	}
	const { errors, warnings } = validateSpecStructure(specFile);
	const issues: Array<{ type: "error" | "warning"; msg: string }> = [
		...errors.map((msg) => ({ type: "error" as const, msg })),
		...warnings.map((msg) => ({ type: "warning" as const, msg })),
	];
	return { id, issues, valid: errors.length === 0 };
}
