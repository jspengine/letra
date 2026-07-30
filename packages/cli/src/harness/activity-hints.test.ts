import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadHarness } from "./loader.js";

describe("canonical harness activity hints", () => {
	it("declares intent for all supported activity kinds", () => {
		const harness = loadHarness(resolve("src/harness/default/v0.1.3"));
		const stages = harness?.flows["flow-main"]?.stages ?? [];
		const declaredKinds = new Set(stages.flatMap((stage) => Object.keys(stage.activity ?? {})));

		expect(declaredKinds).toEqual(
			new Set(["design", "implement", "review", "diagnose", "gate"]),
		);
		expect(
			stages.find((stage) => stage.id === "code")?.activity?.implement?.nextActions,
		).toEqual(
			expect.arrayContaining([expect.objectContaining({ label: "Executar próximo AC" })]),
		);
		expect(
			stages.find((stage) => stage.id === "code")?.activity?.implement?.commands?.[0],
		).toHaveProperty("command", "letra ac done <AC-ID>");
		expect(harness?.gates["human-approved-spec"]?.decisions).toEqual({
			approve: "next",
			"request-changes": "previous",
			reject: "first",
		});
	});
});
