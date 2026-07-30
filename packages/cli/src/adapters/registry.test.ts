import { describe, expect, it } from "vitest";
import {
	ADAPTER_ARTIFACTS,
	ADAPTER_REGISTRY,
	adapterInstructionTargets,
	supportedAdapterTools,
} from "./registry.js";

describe("adapter registry", () => {
	it("publishes the seven supported adapters through one typed contract", () => {
		expect(Object.keys(ADAPTER_REGISTRY)).toEqual([
			"cursor",
			"claude-code",
			"windsurf",
			"vscode",
			"opencode",
			"codex",
			"hermes",
		]);

		expect(supportedAdapterTools().find((adapter) => adapter.id === "codex")).toMatchObject({
			label: "Codex",
			detectionPaths: [".codex/config.toml"],
			capabilities: {
				instructions: true,
				nestedInstructions: true,
				skills: true,
				mcp: true,
				hooks: true,
				liveContext: "mcp",
				refreshMode: "on-demand",
			},
		});
	});

	it("registers AGENTS.md as a shared artifact consumed by Codex and OpenCode", () => {
		expect(ADAPTER_ARTIFACTS["agents-md-shared"]).toMatchObject({
			path: "AGENTS.md",
			consumers: ["opencode", "codex"],
			ownership: "letra-owned",
		});
		expect(ADAPTER_REGISTRY.opencode.artifactIds).toContain("agents-md-shared");
		expect(ADAPTER_REGISTRY.codex.artifactIds).toContain("agents-md-shared");
	});

	it("keeps legacy instruction targets and exposes Codex without rendering config artifacts as markdown", () => {
		const targets = adapterInstructionTargets();
		expect(targets.opencode.paths).toEqual([".opencode/instructions.md", "AGENTS.md"]);
		expect(targets.codex).toMatchObject({
			paths: ["AGENTS.md"],
			format: "text",
			displayName: "Codex",
		});
		expect(targets.codex.paths).not.toContain(".codex/config.toml");
	});
});
