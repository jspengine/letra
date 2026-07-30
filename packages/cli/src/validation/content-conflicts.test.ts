import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Config } from "../config.js";
import { checkConflicts } from "./content.js";

const config: Config = {
	heuristics: {
		"validate-conflict": { severity: "warning" },
	},
};

describe("checkConflicts", () => {
	let specsDir: string;

	function writeAcceptance(spec: string, criteria: string[]): void {
		const specDir = join(specsDir, spec);
		mkdirSync(specDir, { recursive: true });
		writeFileSync(
			join(specDir, "acceptance.md"),
			criteria.map((criterion, index) => `- [ ] **AC${index + 1}**: ${criterion}`).join("\n"),
			"utf-8",
		);
	}

	beforeEach(() => {
		specsDir = join(tmpdir(), `letra-conflicts-${Date.now()}`);
		mkdirSync(specsDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(specsDir)) rmSync(specsDir, { recursive: true, force: true });
	});

	it("groups repeated conflicts from the same spec pair", () => {
		writeAcceptance("authentication", [
			"User can authenticate with secure email credentials",
			"Admin can authenticate with secure email credentials",
		]);
		writeAcceptance("security", [
			"User can not authenticate with secure email credentials",
			"Admin can not authenticate with secure email credentials",
		]);

		const results = checkConflicts(specsDir, config);

		expect(results).toHaveLength(1);
		expect(results[0].passed).toBe(false);
		expect(results[0].message).toContain('4 ocorrências entre "authentication" e "security"');
		expect(results[0].message).toContain(
			'User can authenticate with secure email credentials',
		);
		expect(results[0].message).toContain(
			'Admin can not authenticate with secure email credentials',
		);
	});

	it("keeps conflicts from different spec pairs as separate results", () => {
		writeAcceptance("authentication", [
			"User can authenticate with secure email credentials",
		]);
		writeAcceptance("security", [
			"User can not authenticate with secure email credentials",
		]);
		writeAcceptance("compliance", [
			"User must not authenticate with secure email credentials",
		]);

		const results = checkConflicts(specsDir, config);

		expect(results).toHaveLength(2);
		expect(results.every((result) => result.passed === false)).toBe(true);
	});

	it("preserves the successful result when no conflicts exist", () => {
		writeAcceptance("authentication", ["User can authenticate with email"]);
		writeAcceptance("reporting", ["Admin can export reports as CSV"]);

		expect(checkConflicts(specsDir, config)).toEqual([
			{
				label: "Validate Conflict",
				passed: true,
				message: "Nenhum conflito detectado entre specs",
			},
		]);
	});
});
