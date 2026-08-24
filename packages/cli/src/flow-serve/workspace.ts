import {
	accessSync,
	constants,
	existsSync,
	mkdirSync,
	rmSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import type { AdapterCapabilityProfile } from "@letra/types";
import {
	detectExistingTools,
	detectProjectName,
	loadWorkflow,
	stageFromTemplateStage,
	type Workflow,
} from "../commands/flow-init.js";
import {
	generateAdapters,
	renderAdapterFiles,
	supportedAdapterTools,
} from "../adapters/generate.js";
import { DEFAULT_HARNESS_VERSION } from "../harness/loader.js";
import type { HarnessManifest } from "../harness/types.js";
import {
	ensureExternalWorkspaceLayout,
	getLetraDir as getHomeLetraDir,
} from "../workspace/index.js";

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

export interface WorkspaceSetupAdapterProposal {
	tool: string;
	label: string;
	capabilities: AdapterCapabilityProfile;
	state: "detected" | "available";
	selected: boolean;
	evidence: string[];
}

export interface WorkspaceSetupTargetProposal {
	id: string;
	label: string;
	path: string;
	stack: string[];
	evidence: string[];
	adapters: WorkspaceSetupAdapterProposal[];
}

export interface WorkspaceSetupProposal {
	id: string;
	workspace: {
		name: string;
		root: string;
		harnessVersion: string;
	};
	locations: WorkspaceSetupTargetProposal[];
	warnings: string[];
}

export interface WorkspaceSetupTargetInput {
	id: string;
	label: string;
	path: string;
	adapters: string[];
}

export interface WorkspaceSetupOperation {
	kind: "create" | "update" | "preserve" | "conflict";
	path: string;
	targetId?: string;
	tool?: string;
	artifactId?: string;
	reason: string;
	before?: string;
	after?: string;
	diff?: string;
}

export interface WorkspaceSetupPlan {
	proposalId: string;
	workspaceRoot: string;
	operations: WorkspaceSetupOperation[];
	conflictCount: number;
}

export interface WorkspaceSetupFileSnapshot {
	path: string;
	existed: boolean;
	contentBase64?: string;
}

const TARGET_MARKERS = [
	"package.json",
	"pyproject.toml",
	"requirements.txt",
	"go.mod",
	"Cargo.toml",
	"pom.xml",
	"build.gradle",
	"build.gradle.kts",
];

function hasTargetMarker(path: string): boolean {
	return (
		TARGET_MARKERS.some((marker) => existsSync(join(path, marker))) ||
		existsSync(join(path, ".git"))
	);
}

function detectStack(path: string): { stack: string[]; evidence: string[] } {
	const stack = new Set<string>();
	const evidence: string[] = [];
	const packagePath = join(path, "package.json");
	if (existsSync(packagePath)) {
		stack.add("Node.js");
		evidence.push("package.json");
		try {
			const pkg = JSON.parse(readFileSync(packagePath, "utf-8")) as {
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
			};
			const deps = { ...pkg.dependencies, ...pkg.devDependencies };
			if (deps.react) stack.add("React");
			if (deps.vite) stack.add("Vite");
			if (deps.typescript) stack.add("TypeScript");
			if (deps.next) stack.add("Next.js");
		} catch {
			evidence.push("package.json inválido");
		}
	}
	if (existsSync(join(path, "pyproject.toml")) || existsSync(join(path, "requirements.txt"))) {
		stack.add("Python");
		evidence.push(
			existsSync(join(path, "pyproject.toml")) ? "pyproject.toml" : "requirements.txt",
		);
	}
	if (existsSync(join(path, "go.mod"))) {
		stack.add("Go");
		evidence.push("go.mod");
	}
	if (existsSync(join(path, "Cargo.toml"))) {
		stack.add("Rust");
		evidence.push("Cargo.toml");
	}
	try {
		if (readdirSync(path).some((file) => file.endsWith(".tf"))) {
			stack.add("Terraform");
			evidence.push("arquivos .tf");
		}
	} catch {
		// Access is validated before detection; unreadable children are skipped.
	}
	if (existsSync(join(path, "Dockerfile")) || existsSync(join(path, "docker-compose.yml"))) {
		stack.add("Docker");
		evidence.push(existsSync(join(path, "Dockerfile")) ? "Dockerfile" : "docker-compose.yml");
	}
	return { stack: [...stack], evidence };
}

function targetId(path: string): string {
	const normalized = path.replace(/\\/g, "/").toLowerCase();
	let hash = 2166136261;
	for (const char of normalized) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return `target-${(hash >>> 0).toString(36)}`;
}

function discoverTargetPaths(root: string): string[] {
	const candidates = new Set<string>();
	if (hasTargetMarker(root)) candidates.add(root);
	try {
		for (const entry of readdirSync(root, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules")
				continue;
			const child = join(root, entry.name);
			if (hasTargetMarker(child)) candidates.add(child);
			if (entry.name === "packages" || entry.name === "apps" || entry.name === "services") {
				for (const nested of readdirSync(child, { withFileTypes: true }).slice(0, 50)) {
					if (!nested.isDirectory() || nested.name.startsWith(".")) continue;
					const nestedPath = join(child, nested.name);
					if (hasTargetMarker(nestedPath)) candidates.add(nestedPath);
				}
			}
		}
	} catch {
		// The root access check produces the user-facing error.
	}
	if (candidates.size === 0) candidates.add(root);
	return [...candidates].slice(0, 100);
}

export function analyzeWorkspaceSetup(input: {
	name: string;
	root: string;
}): WorkspaceSetupProposal {
	const root = resolve(input.root);
	if (!existsSync(root) || !statSync(root).isDirectory()) {
		throw new Error("A pasta inicial não existe ou não é um diretório.");
	}
	try {
		accessSync(root, constants.R_OK);
	} catch {
		throw new Error("O Letra não possui permissão para ler a pasta inicial.");
	}

	const tools = supportedAdapterTools();
	const locations = discoverTargetPaths(root).map((path) => {
		const detectedTools = new Set(detectExistingTools(path));
		const detected = detectStack(path);
		return {
			id: targetId(path).replace(/^target-/, "loc-"),
			label: detectProjectName(path) || basename(path),
			path: path.replace(/\\/g, "/"),
			stack: detected.stack,
			evidence: detected.evidence,
			adapters: tools.map((tool) => {
				const isDetected = detectedTools.has(tool.id);
				return {
					tool: tool.id,
					label: tool.label,
					capabilities: tool.capabilities,
					state: isDetected ? ("detected" as const) : ("available" as const),
					selected: isDetected,
					evidence: isDetected
						? tool.detectionPaths.filter((adapterPath) =>
								existsSync(join(path, adapterPath)),
							)
						: [],
				};
			}),
		};
	});

	return {
		id: `proposal-${Date.now().toString(36)}`,
		workspace: {
			name: input.name.trim(),
			root: root.replace(/\\/g, "/"),
			harnessVersion: DEFAULT_HARNESS_VERSION,
		},
		locations,
		warnings: locations.every((location) =>
			location.adapters.every((adapter) => !adapter.selected),
		)
			? ["Nenhuma ferramenta agêntica foi detectada. Selecione os adapters manualmente."]
			: [],
	};
}

function buildLineDiff(before: string, after: string): string {
	if (before === after) return "  Sem alterações de conteúdo.";
	const beforeLines = before === "" ? [] : before.replace(/\r\n/g, "\n").split("\n");
	const afterLines = after === "" ? [] : after.replace(/\r\n/g, "\n").split("\n");
	let prefix = 0;
	while (
		prefix < beforeLines.length &&
		prefix < afterLines.length &&
		beforeLines[prefix] === afterLines[prefix]
	)
		prefix += 1;
	let suffix = 0;
	while (
		suffix < beforeLines.length - prefix &&
		suffix < afterLines.length - prefix &&
		beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
	)
		suffix += 1;

	const lines = [
		...beforeLines.slice(Math.max(0, prefix - 2), prefix).map((line) => `  ${line}`),
		...beforeLines.slice(prefix, beforeLines.length - suffix).map((line) => `- ${line}`),
		...afterLines.slice(prefix, afterLines.length - suffix).map((line) => `+ ${line}`),
		...(suffix > 0
			? afterLines
					.slice(
						afterLines.length - suffix,
						Math.min(afterLines.length, afterLines.length - suffix + 2),
					)
					.map((line) => `  ${line}`)
			: []),
	];
	const limit = 240;
	return lines.length > limit
		? [...lines.slice(0, limit), `  ... ${lines.length - limit} linha(s) omitida(s)`].join("\n")
		: lines.join("\n");
}

function operationFor(
	path: string,
	context: Pick<WorkspaceSetupOperation, "targetId" | "tool" | "artifactId">,
	after: string,
): WorkspaceSetupOperation {
	if (!existsSync(path)) {
		return {
			kind: "create",
			path: path.replace(/\\/g, "/"),
			...context,
			reason: "Arquivo ainda não existe.",
			after,
			diff: buildLineDiff("", after),
		};
	}
	const current = readFileSync(path, "utf-8");
	const generated = /(?:Generated by letra|Gerado (?:por|by) letra)/i.test(current.slice(0, 500));
	const managedSection = context.artifactId === "codex-project-config";
	return {
		kind: generated || managedSection ? "update" : "conflict",
		path: path.replace(/\\/g, "/"),
		...context,
		reason: managedSection
			? "Seção MCP do Letra mesclada preservando a configuração do usuário."
			: generated
				? "Adapter reconhecido como gerado pelo Letra."
				: "Existe conteúdo não reconhecido; o Letra não irá sobrescrevê-lo.",
		before: current,
		after,
		diff: buildLineDiff(current, after),
	};
}

export function planWorkspaceSetup(input: {
	proposalId: string;
	workspaceRoot: string;
	targets: WorkspaceSetupTargetInput[];
	workflow?: Workflow;
}): WorkspaceSetupPlan {
	const workspaceRoot = resolve(input.workspaceRoot);
	const normalizedRoot = workspaceRoot.replace(/\\/g, "/");
	const operations: WorkspaceSetupOperation[] = [];
	const workflowPath = join(workspaceRoot, "workflow.json");
	const workflowBefore = existsSync(workflowPath)
		? readFileSync(workflowPath, "utf-8")
		: undefined;
	const workflowAfter = input.workflow ? JSON.stringify(input.workflow, null, 2) : undefined;
	operations.push({
		kind: workflowBefore ? "conflict" : "create",
		path: workflowPath.replace(/\\/g, "/"),
		reason: workflowBefore
			? "A pasta já contém um workflow; preserve-o ou escolha outra pasta."
			: "Harness canônico do workspace.",
		before: workflowBefore,
		after: workflowAfter,
		diff: workflowAfter ? buildLineDiff(workflowBefore || "", workflowAfter) : undefined,
	});

	for (const target of input.targets) {
		const resolvedTarget = resolve(target.path);
		if (!existsSync(resolvedTarget) || !statSync(resolvedTarget).isDirectory()) {
			throw new Error(`O projeto "${target.label}" não existe ou não é um diretório.`);
		}
		const linkPath = join(resolvedTarget, ".letra-link");
		const linkBefore = existsSync(linkPath) ? readFileSync(linkPath, "utf-8") : undefined;
		const linkAfter = `${normalizedRoot}\n`;
		const linkMatches = linkBefore?.trim().replace(/\\/g, "/") === normalizedRoot;
		operations.push({
			kind: !linkBefore ? "create" : linkMatches ? "preserve" : "conflict",
			path: linkPath.replace(/\\/g, "/"),
			targetId: target.id,
			reason: !linkBefore
				? "Link rastreável para o harness central."
				: linkMatches
					? "O target já aponta para este workspace."
					: "O target está vinculado a outro workspace.",
			before: linkBefore,
			after: linkAfter,
			diff: buildLineDiff(linkBefore || "", linkAfter),
		});

		const renderedAdapters = renderAdapterFiles(resolvedTarget, target.adapters, {
			source: "init",
			quiet: true,
			workspaceDir: workspaceRoot,
			workflow: input.workflow
				? {
						name: input.workflow.name,
						stages: input.workflow.stages,
						items: input.workflow.items,
					}
				: undefined,
			activeStageId: input.workflow?.stages[0]?.id ?? "backlog",
		});
		for (const adapter of renderedAdapters) {
			operations.push(
				operationFor(
					join(resolvedTarget, adapter.path),
					{
						targetId: target.id,
						tool: adapter.tool,
						artifactId: adapter.artifactId,
					},
					adapter.content,
				),
			);
		}
	}
	return {
		proposalId: input.proposalId,
		workspaceRoot: normalizedRoot,
		operations,
		conflictCount: operations.filter((operation) => operation.kind === "conflict").length,
	};
}

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
		throw new Error(
			`Template "${templateId}" not found. Available: ${Object.keys(LEGACY_BOOTSTRAP_TEMPLATES).join(", ")}`,
		);
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
}): { workspace: Record<string, unknown>; workspaceRoot: string; registryFile: string } {
	const name = input.name.trim();
	const description = input.description.trim();
	const workspaceRoot = input.workspacePath
		? resolve(input.workspacePath)
		: resolve(process.cwd());
	mkdirSync(workspaceRoot, { recursive: true });

	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 64);
	const registryDir = join(getHomeLetraDir(), "workspaces", slug);
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
	const registryFile = join(registryDir, "workspace.json");
	if (existsSync(registryFile)) {
		throw new Error("Já existe um workspace registrado com este nome.");
	}
	writeFileSync(registryFile, JSON.stringify(workspace, null, 2), "utf-8");
	return { workspace, workspaceRoot, registryFile };
}

export function writeWorkspaceTargetAdapters(
	workspaceRoot: string,
	targets: WorkspaceSetupTargetInput[],
	workflow: Workflow,
): void {
	const workspaceRootNormalized = workspaceRoot.replace(/\\/g, "/");
	for (const target of targets) {
		const targetPath = resolve(target.path);
		if (!existsSync(targetPath)) continue;
		writeFileSync(join(targetPath, ".letra-link"), `${workspaceRootNormalized}\n`, "utf-8");
		generateAdapters(targetPath, target.adapters, {
			source: "init",
			quiet: true,
			workspaceDir: workspaceRoot,
			workflow: {
				name: workflow.name,
				stages: workflow.stages,
				items: workflow.items,
			},
			activeStageId: workflow.stages[0]?.id ?? "backlog",
		});
	}
}

export function writeExternalWorkspaceSetup(
	workspaceRoot: string,
	workflow: Workflow,
	workspace: Record<string, unknown>,
): void {
	const root = resolve(workspaceRoot);
	ensureExternalWorkspaceLayout(root, { workflow: workflow as unknown as Record<string, unknown>, workspace });
	writeFileSync(join(root, "workflow.json"), JSON.stringify(workflow, null, 2), "utf-8");
	writeFileSync(join(root, "workspace.json"), JSON.stringify(workspace, null, 2), "utf-8");
}

export function workflowLocations(
	targets: WorkspaceSetupTargetInput[],
	workspaceRoot: string,
): Array<{ id: string; path: string; label: string; adapters: string[] }> {
	return targets
		.map((target) => ({
			id: target.id,
			path: target.path.replace(/\\/g, "/"),
			label: target.label,
			adapters: [...target.adapters],
		}))
		.filter(
			(target) =>
				resolve(target.path) !== resolve(workspaceRoot) || target.adapters.length > 0,
		);
}

export function captureWorkspaceSetup(plan: WorkspaceSetupPlan): WorkspaceSetupFileSnapshot[] {
	return plan.operations
		.filter((operation) => operation.kind === "create" || operation.kind === "update")
		.map((operation) => ({
			path: operation.path,
			existed: existsSync(operation.path),
			contentBase64: existsSync(operation.path)
				? Buffer.from(readFileSync(operation.path)).toString("base64")
				: undefined,
		}));
}

export function restoreWorkspaceSetup(snapshots: WorkspaceSetupFileSnapshot[]): void {
	for (const snapshot of [...snapshots].reverse()) {
		if (snapshot.existed) {
			mkdirSync(join(snapshot.path, ".."), { recursive: true });
			writeFileSync(snapshot.path, Buffer.from(snapshot.contentBase64 || "", "base64"));
		} else if (existsSync(snapshot.path)) {
			rmSync(snapshot.path, { force: true });
		}
	}
}

export function saveWorkspaceSetupManifest(
	workspaceRoot: string,
	proposalId: string,
	operations: WorkspaceSetupOperation[],
	snapshots: WorkspaceSetupFileSnapshot[],
): string {
	const manifestId = `setup-${Date.now().toString(36)}`;
	const manifestDir = join(resolve(workspaceRoot), "operations", "setup-manifests");
	mkdirSync(manifestDir, { recursive: true });
	writeFileSync(
		join(manifestDir, `${manifestId}.json`),
		JSON.stringify(
			{
				id: manifestId,
				proposalId,
				createdAt: new Date().toISOString(),
				operations,
				snapshots,
			},
			null,
			2,
		),
		"utf-8",
	);
	return manifestId;
}

export function rollbackWorkspaceSetup(workspaceRoot: string, manifestId: string): void {
	if (!/^setup-[a-z0-9]+$/i.test(manifestId)) throw new Error("Manifest de rollback inválido.");
	const root = resolve(workspaceRoot);
	const manifestPath = existsSync(
		join(root, "operations", "setup-manifests", `${manifestId}.json`),
	)
		? join(root, "operations", "setup-manifests", `${manifestId}.json`)
		: join(root, ".letra", "setup-manifests", `${manifestId}.json`);
	if (!existsSync(manifestPath)) throw new Error("Manifest de rollback não encontrado.");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
		snapshots?: WorkspaceSetupFileSnapshot[];
	};
	restoreWorkspaceSetup(Array.isArray(manifest.snapshots) ? manifest.snapshots : []);
	writeFileSync(
		join(manifestPath, "..", `${manifestId}.rollback.json`),
		JSON.stringify({ manifestId, rolledBackAt: new Date().toISOString() }, null, 2),
		"utf-8",
	);
}
