import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLocalIdentity } from "./service.js";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("local identity registry", () => {
	it("creates a stable identity in the canonical workspace data directory", () => {
		const root = join(tmpdir(), `letra-identity-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		roots.push(root);
		mkdirSync(root, { recursive: true });
		writeFileSync(join(root, "workflow.json"), "{}", "utf8");

		const first = resolveLocalIdentity(root);
		const path = join(root, "identity", "local.json");
		expect(existsSync(path)).toBe(true);
		expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(first);
		expect(first).toMatchObject({
			id: expect.stringMatching(/^human:local:[0-9a-f-]+$/),
			osUser: expect.any(String),
			hostname: expect.any(String),
			createdAt: expect.any(String),
		});
		expect(resolveLocalIdentity(root)).toEqual(first);
	});
});
