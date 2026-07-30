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
} as const satisfies Record<string, AdapterArtifactContract>;

const staticCapabilities = {
	instructions: true,
	nestedInstructions: false,
	skills: false,
	mcp: false,
	hooks: false,
	liveContext: "none",
	refreshMode: "session-start",
} as const satisfies AdapterCapabilityProfile;

export const ADAPTER_REGISTRY = {
	cursor: {
		id: "cursor",
		displayName: "Cursor",
		capabilities: staticCapabilities,
		artifactIds: ["cursor-rules"],
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
		capabilities: staticCapabilities,
		artifactIds: ["vscode-instructions"],
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

export function adapterDiagnosticFiles(): Record<string, { path: string; format: InstructionFormat }> {
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

export function instructionArtifactsForAdapters(adapterIds: string[]): SelectedInstructionArtifact[] {
	const selected = new Set(adapterIds.filter((id) => id in ADAPTER_REGISTRY));
	return Object.values(ADAPTER_ARTIFACTS)
		.filter((artifact) =>
			artifact.kind === "instructions"
			&& artifact.consumers.some((consumer) => selected.has(consumer)))
		.map((artifact) => {
			if (artifact.format !== "at" && artifact.format !== "text") {
				throw new Error(`Artifact "${artifact.id}" is not an instruction format.`);
			}
			const selectedConsumers = artifact.consumers.filter((consumer) => selected.has(consumer));
			const displayName = artifact.id === "agents-md-shared"
				? "OpenCode + Codex"
				: ADAPTER_REGISTRY[selectedConsumers[0] as keyof typeof ADAPTER_REGISTRY].displayName;
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
