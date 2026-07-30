import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	mergeCodexProjectConfig,
	renderLetraHarnessSkill,
} from "./codex-bootstrap.js";
import { generateAdapters, renderAdapterFiles } from "./generate.js";

describe("Codex bootstrap", () => {
	let root: string;

	beforeEach(() => {
		root = join(tmpdir(), `letra-codex-bootstrap-${Date.now()}-${Math.random()}`);
		mkdirSync(join(root, ".letra"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(root)) rmSync(root, { recursive: true, force: true });
	});

	it("merges the managed MCP section without changing user configuration", () => {
		const original = [
			"# Team configuration",
			'model = "gpt-team"',
			"",
			"[mcp_servers.github]",
			'url = "https://example.test/mcp"',
			"",
		].join("\n");

		const merged = mergeCodexProjectConfig(original);

		expect(merged).toContain(original);
		expect(merged).toContain("# letra:codex-mcp:start");
		expect(merged).toContain("[mcp_servers.letra]");
		expect(merged).toContain('command = "letra"');
		expect(merged).toContain('args = ["mcp", "serve", "--stdio"]');
		expect(merged).toContain("required = false");
		expect(mergeCodexProjectConfig(merged)).toBe(merged);
	});

	it("refuses to take ownership of an unmanaged Letra MCP table", () => {
		expect(() => mergeCodexProjectConfig([
			"[mcp_servers.letra]",
			'command = "custom-letra-wrapper"',
		].join("\n"))).toThrow("mcp_servers.letra");
	});

	it("renders a static skill that delegates live state to the MCP", () => {
		const skill = renderLetraHarnessSkill();

		expect(skill).toContain("name: letra-harness");
		expect(skill).toContain("get_direction");
		expect(skill).toContain("letra direction --json");
		expect(skill).toContain("letra operation validate");
		expect(skill).toContain("modo degradado");
		expect(skill).toContain("antes da primeira escrita");
		expect(skill).not.toContain("ITEM-");
		expect(skill).not.toContain("AC4");
	});

	it("composes Codex instructions, project config and skill as distinct artifacts", () => {
		mkdirSync(join(root, ".codex"), { recursive: true });
		writeFileSync(join(root, ".codex", "config.toml"), 'model = "gpt-team"\n');

		const files = renderAdapterFiles(root, ["codex"], { source: "init", quiet: true });

		expect(files.map((file) => file.path)).toEqual([
			"AGENTS.md",
			".codex/config.toml",
			".agents/skills/letra-harness/SKILL.md",
		]);
		expect(files.find((file) => file.path === "AGENTS.md")?.content).toContain("get_direction");
		expect(files.find((file) => file.path === "AGENTS.md")?.content).toContain("letra direction --json");
		expect(files.find((file) => file.path === ".codex/config.toml")?.content).toContain(
			'model = "gpt-team"',
		);
	});

	it("writes the complete Codex bootstrap without modifying unmanaged TOML content", () => {
		mkdirSync(join(root, ".codex"), { recursive: true });
		writeFileSync(join(root, ".codex", "config.toml"), 'model = "gpt-team"\n');

		generateAdapters(root, ["codex"], { source: "init", quiet: true });

		expect(readFileSync(join(root, ".codex", "config.toml"), "utf-8")).toContain(
			'model = "gpt-team"',
		);
		expect(readFileSync(
			join(root, ".agents", "skills", "letra-harness", "SKILL.md"),
			"utf-8",
		)).toContain("get_direction");
	});
});
