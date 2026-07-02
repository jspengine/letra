import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { detectProjectName, loadWorkflow, stageFromTemplateStage, type Workflow } from "../commands/flow-init.js";
import { DEFAULT_HARNESS_VERSION } from "../harness/loader.js";
import type { HarnessManifest } from "../harness/types.js";

interface TemplateStage {
	id: string;
	name: string;
	zone?: "todo" | "doing" | "done";
}

const LEGACY_BOOTSTRAP_TEMPLATES: Record<string, { name: string; stages: TemplateStage[] }> = {
	padrao: {
		name: "Padrão",
		stages: [
			{ id: "backlog", name: "Backlog", zone: "todo" },
			{ id: "design", name: "Design", zone: "doing" },
			{ id: "code", name: "Code", zone: "doing" },
			{ id: "review", name: "Review", zone: "doing" },
			{ id: "done", name: "Done", zone: "done" },
		],
	},
	kanban: {
		name: "Kanban",
		stages: [
			{ id: "todo", name: "A Fazer", zone: "todo" },
			{ id: "doing", name: "Fazendo", zone: "doing" },
			{ id: "done", name: "Feito", zone: "done" },
		],
	},
	agil: {
		name: "Ágil",
		stages: [
			{ id: "product-backlog", name: "Product Backlog", zone: "todo" },
			{ id: "sprint-backlog", name: "Sprint Backlog", zone: "todo" },
			{ id: "in-progress", name: "In Progress", zone: "doing" },
			{ id: "review", name: "Review", zone: "doing" },
			{ id: "done", name: "Done", zone: "done" },
		],
	},
};

export function createWorkflowFromTemplate(
	root: string,
	templateId: string,
	options?: { name?: string; tools?: string[] },
	harness?: HarnessManifest | null,
): Workflow {
	const template = harness?.flows?.[templateId]
		? {
			name: harness.flows[templateId].name,
			stages: harness.flows[templateId].stages.map(stageFromTemplateStage),
		}
		: LEGACY_BOOTSTRAP_TEMPLATES[templateId];
	if (!template) {
		throw new Error(`Template "${templateId}" not found. Available: ${Object.keys(LEGACY_BOOTSTRAP_TEMPLATES).join(", ")}`);
	}

	const stages = template.stages.map((stage, index) => ({
		...stage,
		order: "order" in stage && typeof stage.order === "number" ? stage.order : index,
	}));
	const existing = loadWorkflow(root);
	return {
		version: "1.0",
		name: options?.name ?? detectProjectName(root) ?? template.name,
		language: existing?.language,
		createdAt: existing?.createdAt ?? new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		stages,
		items: existing?.items ?? [],
		specLinks: existing?.specLinks ?? undefined,
		tools: options?.tools ?? existing?.tools ?? [],
		template: templateId,
		harnessVersion: existing?.harnessVersion ?? DEFAULT_HARNESS_VERSION,
	};
}

export function registerWorkspaceSetup(input: {
	name: string;
	description: string;
	workspacePath: string;
	directories: string[];
	tools: string[];
	template: string;
}): { workspace: Record<string, unknown>; workspaceRoot: string } {
	const name = input.name.trim();
	const description = input.description.trim();
	const workspaceRoot = input.workspacePath ? resolve(input.workspacePath) : resolve(process.cwd());
	mkdirSync(workspaceRoot, { recursive: true });

	const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64);
	const home = process.env.HOME || process.env.USERPROFILE || ".";
	const registryDir = join(home, ".letra", "workspaces", slug);
	mkdirSync(registryDir, { recursive: true });

	const workspaceId = `ws_${Date.now().toString(36)}`;
	const createdAt = new Date().toISOString();
	const workspace = {
		id: workspaceId,
		name,
		description,
		slug,
		createdAt,
		root: workspaceRoot.replace(/\\/g, "/"),
		directories: input.directories,
		tools: input.tools,
		template: input.template,
	};
	writeFileSync(join(registryDir, "workspace.json"), JSON.stringify(workspace, null, 2), "utf-8");
	return { workspace, workspaceRoot };
}

export function writeWorkspaceTargetAdapters(
	workspaceRoot: string,
	directories: string[],
	tools: string[],
): void {
	const workspaceRootNormalized = workspaceRoot.replace(/\\/g, "/");
	for (const directory of directories) {
		const targetPath = resolve(directory);
		if (!existsSync(targetPath)) continue;
		writeFileSync(join(targetPath, ".letra-link"), `${workspaceRootNormalized}\n`, "utf-8");
		for (const tool of tools) {
			if (tool === "opencode") {
				const opencodeDir = join(targetPath, ".opencode");
				if (!existsSync(opencodeDir)) mkdirSync(opencodeDir, { recursive: true });
				writeFileSync(join(opencodeDir, "instructions.md"), `# OpenCode Adapter - Auto-generated\n\nRefer to workspace harness at:\n${workspaceRootNormalized}/.letra/\n`, "utf-8");
			}
			if (tool === "cursor") {
				writeFileSync(join(targetPath, ".cursorrules"), `@include ${workspaceRootNormalized}/.letra/context.md\n@include ${workspaceRootNormalized}/.letra/constitution.md\n@include ${workspaceRootNormalized}/.letra/glossary.md\n`, "utf-8");
			}
			if (tool === "claude-code") {
				writeFileSync(join(targetPath, "CLAUDE.md"), `# Claude Code Adapter\n\nRefer to the Letra harness at:\n${workspaceRootNormalized}/.letra/\n`, "utf-8");
			}
			if (tool === "windsurf") {
				writeFileSync(join(targetPath, ".windsurfrules"), `@include ${workspaceRootNormalized}/.letra/context.md\n`, "utf-8");
			}
		}
	}
}
