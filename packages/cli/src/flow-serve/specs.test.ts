import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Workflow } from "../commands/flow-init.js";
import { loadResolvedSpecs } from "./specs.js";

describe("resolved specs and catalog disposition", () => {
	const roots: string[] = [];
	afterEach(() => {
		for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
	});

	it("excludes archived specs from the active surface while retaining canonical links for active specs", () => {
		const root = join(tmpdir(), `letra-resolved-specs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		roots.push(root);
		const specs = join(root, ".letra", "specs");
		mkdirSync(join(specs, "active-spec"), { recursive: true });
		mkdirSync(join(specs, "archived-spec"), { recursive: true });
		writeFileSync(join(specs, "active-spec", "spec.md"), "# Active");
		writeFileSync(join(specs, "archived-spec", "spec.md"), "# Archived");
		writeFileSync(join(root, ".letra", "spec-catalog.json"), JSON.stringify({
			schemaVersion: "1",
			generatedAt: new Date().toISOString(),
			source: { workflowPath: ".letra/workflow.json", specsPath: ".letra/specs/", focusPath: ".letra/focus.md" },
			currentFocus: { spec: "active-spec", itemId: "ITEM-1" },
			dispositionsPath: ".letra/spec-dispositions.json",
			specs: [
				{ id: "active-spec", path: ".letra/specs/active-spec/spec.md", status: "active", valid: true, itemIds: [], stages: [], lastUsedAt: null, lastUseSource: "unknown", dependencies: [], disposition: { specId: "active-spec", disposition: "active" } },
				{ id: "archived-spec", path: ".letra/specs/archived-spec/spec.md", status: "unlinked", valid: true, itemIds: [], stages: [], lastUsedAt: null, lastUseSource: "unknown", dependencies: [], disposition: { specId: "archived-spec", disposition: "archived" } },
			],
			items: [],
		}), "utf8");
		const workflow = { specLinks: { "active-spec": { path: ".letra/specs/active-spec/spec.md" }, "archived-spec": { path: ".letra/specs/archived-spec/spec.md" } } } as unknown as Workflow;
		expect(loadResolvedSpecs(root, workflow).map((spec) => spec.id)).toEqual(["active-spec"]);
	});
});
