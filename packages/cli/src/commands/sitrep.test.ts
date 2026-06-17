import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sitrep } from "./sitrep.js";

describe("sitrep", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-sitrep-test-${Date.now()}`);
		mkdirSync(join(tmpDir, ".letra"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	});

	function writeContext(content: string): void {
		writeFileSync(join(tmpDir, ".letra", "context.md"), content, "utf-8");
	}

	function writeWorkflow(): void {
		writeFileSync(
			join(tmpDir, ".letra", "workflow.json"),
			JSON.stringify({
				name: "test-project",
				stages: [
					{ id: "backlog", order: 0 },
					{ id: "code", order: 1 },
					{ id: "done", order: 2 },
				],
				items: [
					{ id: "ITEM-1", description: "Feature X", stage: "code", spec: "feature-x" },
					{ id: "ITEM-2", description: "Bug Y", stage: "backlog" },
				],
			}),
		);
	}

	it("warns when context.md does not exist", async () => {
		const log = console.log;
		const messages: string[] = [];
		console.log = (msg: string) => messages.push(msg);

		await sitrep(tmpDir);

		console.log = log;
		expect(messages.some((m) => m.includes("não encontrado"))).toBe(true);
	});

	it("preserves manual sections and updates data", async () => {
		writeContext(`# Context

> Updated: 2020-01-01T00:00:00.000Z
> Owner: letra-dev

## Intent

Manual intent text

## Stack

Manual stack text

## Restrições Reais

Manual constraints

## Porquês

Manual whys
`);
		writeWorkflow();

		await sitrep(tmpDir);

		const content = readFileSync(join(tmpDir, ".letra", "context.md"), "utf-8");
		expect(content).toContain("Manual intent text");
		expect(content).toContain("Manual stack text");
		expect(content).toContain("Manual constraints");
		expect(content).toContain("Manual whys");
		expect(content).toContain("> Owner: letra-dev");
		expect(content).toContain("<!-- sitrep:start -->");
		expect(content).toContain("<!-- sitrep:end -->");
		expect(content).toContain("ITEM-1");
		expect(content).toContain("Feature X");
		expect(content).not.toContain("2020-01-01");
	}, 15000);

	it("inserts sitrep block before ## Stack when missing", async () => {
		writeContext(`# Context

> Updated: 2020-01-01T00:00:00.000Z

## Intent

Some intent

## Stack

Stack content
`);
		writeWorkflow();

		await sitrep(tmpDir);

		const content = readFileSync(join(tmpDir, ".letra", "context.md"), "utf-8");
		const stackIndex = content.indexOf("## Stack");
		const sitrepStart = content.indexOf("<!-- sitrep:start -->");
		expect(sitrepStart).toBeGreaterThan(-1);
		expect(sitrepStart).toBeLessThan(stackIndex);
	}, 15000);

	it("works without workflow (fallback)", async () => {
		writeContext(`# Context

> Updated: 2020-01-01T00:00:00.000Z

## Intent

Some intent

## Stack

Stack content
`);

		await sitrep(tmpDir);

		const content = readFileSync(join(tmpDir, ".letra", "context.md"), "utf-8");
		expect(content).toContain("<!-- sitrep:start -->");
		expect(content).toContain("sem workflow definido");
	});

	it("dry-run does not modify file", async () => {
		writeContext(`# Context

> Updated: 2020-01-01T00:00:00.000Z

## Intent

Some intent

## Stack

Stack content
`);
		writeWorkflow();

		const origContent = readFileSync(join(tmpDir, ".letra", "context.md"), "utf-8");
		await sitrep(tmpDir, { dryRun: true });

		const afterContent = readFileSync(join(tmpDir, ".letra", "context.md"), "utf-8");
		expect(afterContent).toBe(origContent);
	});

	it("preserves content after <!-- sitrep:ignore --> marker", async () => {
		writeContext(`# Context

> Updated: 2020-01-01T00:00:00.000Z

## Intent

Some intent

## Stack

Stack content

<!-- sitrep:ignore -->
## Ignored Section

This should stay
`);

		await sitrep(tmpDir);

		const content = readFileSync(join(tmpDir, ".letra", "context.md"), "utf-8");
		expect(content).toContain("Ignored Section");
		expect(content).toContain("This should stay");
	});

	it("shows 0 alertas when no health record", async () => {
		writeContext(`# Context

> Updated: 2020-01-01T00:00:00.000Z

## Stack

Stack content
`);

		await sitrep(tmpDir);

		const content = readFileSync(join(tmpDir, ".letra", "context.md"), "utf-8");
		expect(content).toContain("0 alertas");
	});
});

