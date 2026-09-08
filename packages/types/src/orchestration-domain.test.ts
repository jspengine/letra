import { describe, expect, it } from "vitest";
import { resolveActorBinding, validateDomain, type DomainCatalog } from "./orchestration-domain";

const catalog: DomainCatalog = {
	workspace: { id: "ws", root: "/repo", harnessVersion: "v2" },
	roles: [{ id: "builder", label: "Builder", capabilities: ["code", "test"], allowedStages: ["code"] }],
	identities: [{ id: "turing", displayName: "Alan Turing", roleIds: ["builder"], status: "online" }],
	executors: [
		{ id: "offline", capabilities: ["code", "test"], status: "offline" },
		{ id: "zeta", capabilities: ["code", "test"], status: "online" },
		{ id: "alpha", capabilities: ["code", "test"], status: "online" },
	],
};

describe("canonical orchestration domain", () => {
	it("resolves identity, role and executor deterministically and skips offline", () => {
		expect(resolveActorBinding(catalog, "turing", "builder")).toMatchObject({ actorId: "turing:builder:alpha", executorId: "alpha" });
		expect(resolveActorBinding(catalog, "turing", "builder", "zeta")?.executorId).toBe("zeta");
		expect(resolveActorBinding(catalog, "turing", "missing")).toBeNull();
	});

	it("rejects orphan roles and invalid run bindings", () => {
		const issues = validateDomain({ ...catalog, identities: [{ ...catalog.identities[0], roleIds: ["missing"] }] });
		expect(issues.some((issue) => issue.code === "ORPHAN_ROLE")).toBe(true);
	});

	it("keeps validation safe for migrated duplicates and offline-only executors", () => {
		const migrated = { ...catalog, roles: [...catalog.roles, { ...catalog.roles[0] }], executors: [{ id: "only", capabilities: ["code"], status: "offline" as const }] };
		const issues = validateDomain(migrated);
		expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["DUPLICATE_ID", "CAPABILITY_MISMATCH"]));
		expect(resolveActorBinding(migrated, "turing", "builder")).toBeNull();
	});
});
