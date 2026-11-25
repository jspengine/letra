import type {
	AdapterArtifactContract,
	AdapterCapabilityProfile,
	AdapterContract,
} from "@letra/types";

type InstructionFormat = "at" | "text";

export interface AdapterInstructionTarget {
	paths: string[];
	format: InstructionFormat;
	displayName: string;
}

export interface SelectedInstructionArtifact extends AdapterInstructionTarget {
	id: string;
	path: string;
	tool: string;
}

export interface SupportedAdapterTool extends AdapterContract {
	label: string;
	paths: string[];
}

export const ADAPTER_ARTIFACTS = {
	"cursor-rules": {
		id: "cursor-rules",
		path: ".cursorrules",
		format: "at",
		kind: "instructions",
		consumers: ["cursor"],
		ownership: "letra-owned",
	},
	"claude-instructions": {
		id: "claude-instructions",
		path: "CLAUDE.md",
		format: "text",
		kind: "instructions",
		consumers: ["claude-code"],
		ownership: "letra-owned",
	},
	"windsurf-rules": {
		id: "windsurf-rules",
		path: ".windsurfrules",
		format: "at",
		kind: "instructions",
		consumers: ["windsurf"],
		ownership: "letra-owned",
	},
	"vscode-instructions": {
		id: "vscode-instructions",
		path: ".github/copilot-instructions.md",
		format: "text",
		kind: "instructions",
		consumers: ["vscode"],
		ownership: "letra-owned",
	},
	"opencode-instructions": {
		id: "opencode-instructions",
		path: ".opencode/instructions.md",
		format: "text",
		kind: "instructions",
		consumers: ["opencode"],
		ownership: "letra-owned",
	},
	"agents-md-shared": {
		id: "agents-md-shared",
		path: "AGENTS.md",
		format: "text",
		kind: "instructions",
		consumers: ["opencode", "codex"],
		ownership: "letra-owned",
	},
	"codex-project-config": {
		id: "codex-project-config",
		path: ".codex/config.toml",
		format: "toml",
		kind: "config",
		consumers: ["codex"],
		ownership: "managed-section",
	},
	"letra-harness-skill": {
		id: "letra-harness-skill",
		path: ".agents/skills/letra-harness/SKILL.md",
		format: "skill",
		kind: "skill",
		consumers: ["codex"],
		ownership: "letra-owned",
	},
	"hermes-instructions": {
		id: "hermes-instructions",
		path: ".hermes/instructions.md",
		format: "text",
		kind: "instructions",
		consumers: ["hermes"],
		ownership: "letra-owned",
	},
	"kiro-steering": {
		id: "kiro-steering",
		// Sem frontmatter, o Kiro aplica o steering com inclusion "always".
		path: ".kiro/steering/letra.md",
		format: "text",
		kind: "instructions",
		consumers: ["kiro"],
		ownership: "letra-owned",
	},
	"vscode-mcp-config": {
		id: "vscode-mcp-config",
		path: ".vscode/mcp.json",
		format: "json",
		kind: "config",
		consumers: ["vscode"],
		ownership: "managed-section",
	},
	"cursor-mcp-config": {
		id: "cursor-mcp-config",
		path: ".cursor/mcp.json",
		format: "json",
		kind: "config",
		consumers: ["cursor"],
		ownership: "managed-section",
	},
	"kiro-mcp-config": {
		id: "kiro-mcp-config",
		path: ".kiro/settings/mcp.json",
		format: "json",
		kind: "config",
		consumers: ["kiro"],
		ownership: "managed-section",
	},
} as const satisfies Record<string, AdapterArtifactContract>;

/** Artefatos JSON de MCP e o dialeto (chave raiz) que cada editor espera. */
export const MCP_JSON_CONFIG_ARTIFACTS = {
	"vscode-mcp-config": "servers",
	"cursor-mcp-config": "mcpServers",
	"kiro-mcp-config": "mcpServers",
} as const;

const staticCapabilities = {
	instructions: true,
	nestedInstructions: false,
	skills: false,
	mcp: false,
	hooks: false,
	liveContext: "none",
	refreshMode: "session-start",
} as const satisfies AdapterCapabilityProfile;

/** Instruções estáticas + servidor MCP do Letra registrado na config do editor. */
const mcpCapabilities = {
	...staticCapabilities,
	mcp: true,
	liveContext: "mcp",
	refreshMode: "on-demand",
} as const satisfies AdapterCapabilityProfile;

export const ADAPTER_REGISTRY = {
	cursor: {
		id: "cursor",
		displayName: "Cursor",
		capabilities: mcpCapabilities,
		artifactIds: ["cursor-rules", "cursor-mcp-config"],
		detectionPaths: [".cursorrules"],
		fallbackTransport: "cli-json",
	},
	"claude-code": {
		id: "claude-code",
		displayName: "Claude Code",
		capabilities: staticCapabilities,
		artifactIds: ["claude-instructions"],
		detectionPaths: ["CLAUDE.md"],
		fallbackTransport: "cli-json",
	},
	windsurf: {
		id: "windsurf",
		displayName: "Windsurf",
		capabilities: staticCapabilities,
		artifactIds: ["windsurf-rules"],
		detectionPaths: [".windsurfrules"],
		fallbackTransport: "cli-json",
	},
	vscode: {
		id: "vscode",
		displayName: "VSCode Copilot",
		capabilities: mcpCapabilities,
		artifactIds: ["vscode-instructions", "vscode-mcp-config"],
		detectionPaths: [".github/copilot-instructions.md"],
		fallbackTransport: "cli-json",
	},
	opencode: {
		id: "opencode",
		displayName: "OpenCode",
		capabilities: {
			...staticCapabilities,
			skills: true,
		},
		artifactIds: ["opencode-instructions", "agents-md-shared"],
		detectionPaths: [".opencode/instructions.md", "AGENTS.md"],
		fallbackTransport: "cli-json",
	},
	codex: {
		id: "codex",
		displayName: "Codex",
		capabilities: {
			instructions: true,
			nestedInstructions: true,
			skills: true,
			mcp: true,
			hooks: true,
			liveContext: "mcp",
			refreshMode: "on-demand",
		},
		artifactIds: ["agents-md-shared", "codex-project-config", "letra-harness-skill"],
		detectionPaths: [".codex/config.toml"],
		fallbackTransport: "cli-json",
	},
	hermes: {
		id: "hermes",
		displayName: "Hermes Agent",
		capabilities: staticCapabilities,
		artifactIds: ["hermes-instructions"],
		detectionPaths: [".hermes/instructions.md"],
		fallbackTransport: "cli-json",
	},
	kiro: {
		id: "kiro",
		displayName: "Kiro",
		capabilities: mcpCapabilities,
		artifactIds: ["kiro-steering", "kiro-mcp-config"],
		detectionPaths: [".kiro/steering/letra.md"],
		fallbackTransport: "cli-json",
	},
} as const satisfies Record<string, AdapterContract>;

export function adapterInstructionTargets(): Record<string, AdapterInstructionTarget> {
	return Object.fromEntries(
		Object.values(ADAPTER_REGISTRY).map((adapter) => {
			const artifacts = adapter.artifactIds
				.map((id) => ADAPTER_ARTIFACTS[id])
				.filter((artifact) => artifact.kind === "instructions");
			const format = artifacts[0]?.format;
			if (format !== "at" && format !== "text") {
				throw new Error(`Adapter "${adapter.id}" has no instruction artifact.`);
			}
			if (artifacts.some((artifact) => artifact.format !== format)) {
				throw new Error(`Adapter "${adapter.id}" mixes instruction formats.`);
			}
			return [
				adapter.id,
				{
					paths: artifacts.map((artifact) => artifact.path),
					format,
					displayName: adapter.displayName,
				},
			];
		}),
	);
}

export function adapterDiagnosticFiles(): Record<
	string,
	{ path: string; format: InstructionFormat }
> {
	const instructionTargets = adapterInstructionTargets();
	return Object.fromEntries(
		Object.values(ADAPTER_REGISTRY).map((adapter) => {
			const target = instructionTargets[adapter.id];
			const sharedAgentsPath = target.paths.includes("AGENTS.md") ? "AGENTS.md" : null;
			return [
				adapter.id,
				{
					path: sharedAgentsPath ?? target.paths[0],
					format: target.format,
				},
			];
		}),
	);
}

export function instructionArtifactsForAdapters(
	adapterIds: string[],
): SelectedInstructionArtifact[] {
	const selected = new Set(adapterIds.filter((id) => id in ADAPTER_REGISTRY));
	return Object.values(ADAPTER_ARTIFACTS)
		.filter(
			(artifact) =>
				artifact.kind === "instructions" &&
				artifact.consumers.some((consumer) => selected.has(consumer)),
		)
		.map((artifact) => {
			if (artifact.format !== "at" && artifact.format !== "text") {
				throw new Error(`Artifact "${artifact.id}" is not an instruction format.`);
			}
			const selectedConsumers = artifact.consumers.filter((consumer) =>
				selected.has(consumer),
			);
			const displayName =
				artifact.id === "agents-md-shared"
					? "OpenCode + Codex"
					: ADAPTER_REGISTRY[selectedConsumers[0] as keyof typeof ADAPTER_REGISTRY]
							.displayName;
			return {
				id: artifact.id,
				path: artifact.path,
				paths: [artifact.path],
				format: artifact.format,
				displayName,
				tool: selectedConsumers.join(","),
			};
		});
}

export function supportedAdapterTools(): SupportedAdapterTool[] {
	const targets = adapterInstructionTargets();
	return Object.values(ADAPTER_REGISTRY).map((adapter) => ({
		...adapter,
		label: adapter.displayName,
		paths: [...targets[adapter.id].paths],
		detectionPaths: [...adapter.detectionPaths],
		artifactIds: [...adapter.artifactIds],
		capabilities: { ...adapter.capabilities },
	}));
}
