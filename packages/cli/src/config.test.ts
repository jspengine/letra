import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("config", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-config-test-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("should return defaults when no config file exists", async () => {
		const { loadConfig } = await import("./config.js");
		const config = loadConfig(tmpDir);

		expect(config.heuristics["conteudo-minimo"]).toBeDefined();
		expect(config.heuristics["conteudo-minimo"].severity).toBe("warning");
		expect(config.heuristics["conteudo-minimo"].minChars).toBe(50);
		expect(config.heuristics["detecao-tom"].blacklist).toContain("blz");
		expect(config.heuristics["drift-temporal"].maxDays).toBe(30);
	});

	it("should merge user config with defaults", async () => {
		writeFileSync(
			join(tmpDir, ".letra", "config.json"),
			JSON.stringify({
				heuristics: {
					"conteudo-minimo": { severity: "error", minChars: 100 },
					"detecao-tom": { severity: "off" },
				},
			}),
		);

		const { loadConfig } = await import("./config.js");
		const config = loadConfig(tmpDir);

		expect(config.heuristics["conteudo-minimo"].severity).toBe("error");
		expect(config.heuristics["conteudo-minimo"].minChars).toBe(100);
		expect(config.heuristics["detecao-tom"].severity).toBe("off");
		expect(config.heuristics["drift-temporal"].severity).toBe("warning");
	});

	it("should handle malformed config gracefully", async () => {
		writeFileSync(join(tmpDir, ".letra", "config.json"), "invalid json");

		const { loadConfig } = await import("./config.js");
		const config = loadConfig(tmpDir);

		expect(config.heuristics["conteudo-minimo"]).toBeDefined();
		expect(config.heuristics["conteudo-minimo"].severity).toBe("warning");
	});

	it("should add custom heuristics from user config", async () => {
		writeFileSync(
			join(tmpDir, ".letra", "config.json"),
			JSON.stringify({
				heuristics: {
					"custom-regra": { severity: "error" },
				},
			}),
		);

		const { loadConfig } = await import("./config.js");
		const config = loadConfig(tmpDir);

		expect(config.heuristics["custom-regra"]).toBeDefined();
		expect(config.heuristics["custom-regra"].severity).toBe("error");
	});
});

describe("getHeuristicConfig", () => {
	it("should return correct config by label", async () => {
		const { loadConfig, getHeuristicConfig } = await import("./config.js");
		const config = loadConfig("/nonexistent");

		const result = getHeuristicConfig(config, "Conteúdo Mínimo");
		expect(result.severity).toBe("warning");
		expect(result.minChars).toBe(50);
	});

	it("should return defaults for unknown labels", async () => {
		const { loadConfig, getHeuristicConfig } = await import("./config.js");
		const config = loadConfig("/nonexistent");

		const result = getHeuristicConfig(config, "Regra Desconhecida");
		expect(result.severity).toBe("warning");
	});

	it("should map terminology label correctly", async () => {
		const { loadConfig, getHeuristicConfig } = await import("./config.js");
		const config = loadConfig("/nonexistent");

		const result = getHeuristicConfig(config, "Consistência de Terminologia");
		expect(result).toBeDefined();
	});
});
