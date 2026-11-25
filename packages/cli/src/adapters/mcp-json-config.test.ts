import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mergeMcpJsonConfig } from "./mcp-json-config.js";
import { renderAdapterFiles } from "./generate.js";

const roots: string[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("mergeMcpJsonConfig", () => {
	it("creates the VS Code dialect with a stdio letra server", () => {
		expect(JSON.parse(mergeMcpJsonConfig("", "servers", ".vscode/mcp.json"))).toEqual({
			servers: { letra: { type: "stdio", command: "letra", args: ["mcp", "serve", "--stdio"] } },
		});
	});

	it("creates the Cursor/Kiro dialect under mcpServers", () => {
		expect(JSON.parse(mergeMcpJsonConfig("", "mcpServers", ".cursor/mcp.json"))).toEqual({
			mcpServers: { letra: { command: "letra", args: ["mcp", "serve", "--stdio"] } },
		});
	});

	it("preserves other servers, top-level fields and user extras on the letra entry", () => {
		const existing = JSON.stringify({
			inputs: [{ id: "token" }],
			mcpServers: {
				github: { command: "gh-mcp" },
				letra: { command: "letra", args: ["mcp", "serve"], disabled: false, autoApprove: ["get_direction"] },
			},
		});
		const merged = JSON.parse(mergeMcpJsonConfig(existing, "mcpServers", ".kiro/settings/mcp.json"));
		expect(merged.inputs).toEqual([{ id: "token" }]);
		expect(merged.mcpServers.github).toEqual({ command: "gh-mcp" });
		expect(merged.mcpServers.letra).toEqual({
			command: "letra",
			args: ["mcp", "serve", "--stdio"],
			disabled: false,
			autoApprove: ["get_direction"],
		});
	});

	it("is idempotent", () => {
		const once = mergeMcpJsonConfig("", "servers", ".vscode/mcp.json");
		expect(mergeMcpJsonConfig(once, "servers", ".vscode/mcp.json")).toBe(once);
	});

	it("refuses to overwrite a letra entry it does not own", () => {
		const custom = JSON.stringify({ mcpServers: { letra: { command: "cmd", args: ["/c", "npx", "tsx", "src/index.ts"] } } });
		expect(() => mergeMcpJsonConfig(custom, "mcpServers", ".cursor/mcp.json")).toThrow(/not managed by Letra/);
	});

	it("refuses JSONC instead of dropping the user's comments", () => {
		expect(() => mergeMcpJsonConfig('{\n  // mine\n  "servers": {}\n}', "servers", ".vscode/mcp.json")).toThrow(/not plain JSON/);
	});
});

describe("renderAdapterFiles MCP configs", () => {
	function workspace(): string {
		const root = mkdtempSync(join(tmpdir(), "letra-mcp-json-"));
		roots.push(root);
		mkdirSync(join(root, ".letra"), { recursive: true });
		return root;
	}

	it("projects steering and MCP config for vscode, cursor and kiro", () => {
		const root = workspace();
		const files = renderAdapterFiles(root, ["vscode", "cursor", "kiro"], { source: "sync", quiet: true });
		const paths = files.map((file) => file.path);
		expect(paths).toEqual(
			expect.arrayContaining([
				".github/copilot-instructions.md",
				".vscode/mcp.json",
				".cursorrules",
				".cursor/mcp.json",
				".kiro/steering/letra.md",
				".kiro/settings/mcp.json",
			]),
		);
		const steering = files.find((file) => file.path === ".kiro/steering/letra.md")!;
		expect(steering.content).toContain("# Letra Agent Bootstrap");
		expect(JSON.parse(files.find((file) => file.path === ".vscode/mcp.json")!.content).servers.letra.type).toBe("stdio");
	});

	it("does not emit MCP configs for adapters that were not selected", () => {
		const root = workspace();
		const paths = renderAdapterFiles(root, ["claude-code"], { source: "sync", quiet: true }).map((file) => file.path);
		expect(paths.some((path) => path.endsWith("mcp.json"))).toBe(false);
	});

	it("skips a user-owned MCP config without blocking the instruction files", () => {
		const root = workspace();
		mkdirSync(join(root, ".cursor"), { recursive: true });
		const custom = `${JSON.stringify({ mcpServers: { letra: { command: "cmd", args: ["/c", "letra"] } } })}\n`;
		writeFileSync(join(root, ".cursor", "mcp.json"), custom);
		const paths = renderAdapterFiles(root, ["cursor"], { source: "sync", quiet: true }).map((file) => file.path);
		expect(paths).toEqual([".cursorrules"]);
		expect(readFileSync(join(root, ".cursor", "mcp.json"), "utf-8")).toBe(custom);
	});
});
