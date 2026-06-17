import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { harnessMetaTestDetector } from "./harness-meta-test.js";

const REQUIRED = ["ac-stale", "ac-false-pos", "harness-stale", "missing-dir", "stage-drift", "missing-spec-link"];

function engineContent(detectorNames: string[]): string {
	const importLines = detectorNames.map((n) => {
		const camel = n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
		return `import { ${camel}Detector } from "./detectors/${n}.js";`;
	}).join("\n");
	const vars = detectorNames.map((n) => {
		const camel = n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
		return `\t\t${camel}Detector`;
	});
	return `${importLines}
import type { Detector } from "./types.js";

export class DiagnosticEngine {
\tprivate detectors: Detector[] = [
${vars.join(",\n")}
\t];
\tasync runAll(): Promise<unknown> { return {}; }
}`;
}

const SNAPSHOT_TPL = `const MAX_SNAPSHOTS = 20;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
export class SnapshotStore {}`;

describe("harness-meta-test detector", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = join(tmpdir(), `letra-harness-meta-test-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	function writeEngine(detectorNames: string[]) {
		const dir = join(tmpDir, "packages", "cli", "src", "diagnostics");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "engine.ts"), engineContent(detectorNames));
	}

	function writeSnapshot() {
		const dir = join(tmpDir, "packages", "cli", "src", "diagnostics");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "snapshot.ts"), SNAPSHOT_TPL);
	}

	function writeDetector(name: string, certainty: number, hasAutoFix: boolean) {
		const dir = join(tmpDir, "packages", "cli", "src", "diagnostics", "detectors");
		mkdirSync(dir, { recursive: true });
		const autoFixBlock = hasAutoFix
			? ',\n\tautoFix: async () => ({ files: [], snapshotId: "x" })'
			: "";
		writeFileSync(
			join(dir, `${name}.ts`),
			`import type { Detector } from "../types.js";
export const ${name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Detector: Detector = {
\tname: "${name}",
\tcertainty: ${certainty},${autoFixBlock}
\trun: async () => [],
};`,
		);
	}

	function writeAllOk() {
		writeEngine(REQUIRED);
		writeSnapshot();
		for (const d of REQUIRED) {
			const cert = d === "ac-false-pos" ? 0.7 : d === "stage-drift" ? 0.8 : 1;
			writeDetector(d, cert, cert >= 0.9);
		}
	}

	it("should be silent when all detectors present, TTL correct, and consistency ok", async () => {
		writeAllOk();
		const results = await harnessMetaTestDetector.run(tmpDir);
		expect(results).toHaveLength(0);
	});

	it("should detect when a required detector is missing from engine.ts", async () => {
		const present = ["ac-stale", "ac-false-pos", "harness-stale", "stage-drift"];
		writeEngine(present);
		writeSnapshot();
		for (const d of present) {
			const cert = d === "ac-false-pos" ? 0.7 : d === "stage-drift" ? 0.8 : 1;
			writeDetector(d, cert, cert >= 0.9);
		}

		const results = await harnessMetaTestDetector.run(tmpDir);
		const missingResult = results.find((r) => r.id.includes("missing-detectors"));
		expect(missingResult).toBeDefined();
		expect(missingResult!.description).toContain("missing-dir");
	});

	it("should report missing engine.ts as error", async () => {
		const results = await harnessMetaTestDetector.run(tmpDir);
		const engineResult = results.find((r) => r.id === "harness-meta-test_engine-not-found");
		expect(engineResult).toBeDefined();
		expect(engineResult!.type).toBe("error");
	});

	it("should detect TTL_MS mismatch", async () => {
		const dir = join(tmpDir, "packages", "cli", "src", "diagnostics");
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "snapshot.ts"),
			`const TTL_MS = 7 * 24 * 60 * 60 * 1000;`,
		);
		writeEngine(REQUIRED);
		const results = await harnessMetaTestDetector.run(tmpDir);
		const ttlResult = results.find((r) => r.id === "harness-meta-test_ttl-wrong");
		expect(ttlResult).toBeDefined();
	});

	it("should detect when certainty ≥ 0.9 detector lacks autoFix", async () => {
		writeEngine(REQUIRED);
		writeSnapshot();
		writeDetector("ac-stale", 1, false);
		writeDetector("ac-false-pos", 0.7, false);
		writeDetector("harness-stale", 1, true);
		writeDetector("missing-dir", 1, true);
		writeDetector("stage-drift", 0.8, true);

		const results = await harnessMetaTestDetector.run(tmpDir);
		const autoFixResult = results.find((r) => r.id.includes("ac-stale-missing-autofix"));
		expect(autoFixResult).toBeDefined();
	});

	it("should detect when certainty < 0.9 detector has autoFix", async () => {
		writeEngine(REQUIRED);
		writeSnapshot();
		writeDetector("ac-stale", 1, true);
		writeDetector("ac-false-pos", 0.7, true);
		writeDetector("harness-stale", 1, true);
		writeDetector("missing-dir", 1, true);
		writeDetector("stage-drift", 0.8, true);

		const results = await harnessMetaTestDetector.run(tmpDir);
		const unexpectedFix = results.find((r) => r.id.includes("ac-false-pos-unexpected-autofix"));
		expect(unexpectedFix).toBeDefined();
	});

	it("should detect MAX_SNAPSHOTS < 20", async () => {
		const dir = join(tmpDir, "packages", "cli", "src", "diagnostics");
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, "snapshot.ts"), `const MAX_SNAPSHOTS = 5;\nconst TTL_MS = 30 * 24 * 60 * 60 * 1000;`);
		writeEngine(REQUIRED);
		const results = await harnessMetaTestDetector.run(tmpDir);
		const snapResult = results.find((r) => r.id === "harness-meta-test_max-snapshots-low");
		expect(snapResult).toBeDefined();
	});

	it("should auto-fix add placeholder comment for missing detector", async () => {
		const present = ["ac-stale", "ac-false-pos", "harness-stale", "stage-drift"];
		writeEngine(present);
		writeSnapshot();
		for (const d of present) {
			const cert = d === "ac-false-pos" ? 0.7 : d === "stage-drift" ? 0.8 : 1;
			writeDetector(d, cert, cert >= 0.9);
		}

		const results = await harnessMetaTestDetector.run(tmpDir);
		const fix = results.find((r) => r.autoFix);
		expect(fix).toBeDefined();
		expect(fix!.autoFix).toBeDefined();
		const fixResult = await fix!.autoFix!();
		expect(fixResult.files).toHaveLength(1);
		expect(fixResult.files[0].after).toContain("TODO");
	});

	it("should be dev-only", async () => {
		expect(harnessMetaTestDetector.devOnly).toBe(true);
	});
});
