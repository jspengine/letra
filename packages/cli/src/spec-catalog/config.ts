/**
 * Declarative workspace configuration for the spec catalog.
 *
 * All product-specific IDs, consolidation targets, canonical specs and
 * priority tiers live here.  The catalog service reads this file instead
 * of embedding hardcoded constants, making the system generic and
 * configurable per-workspace.
 */

export interface SpecCatalogConfig {
	/** Maps specId → canonical target for consolidated specs. */
	consolidationTargets: Record<string, string>;
	/** Spec IDs considered canonical in the current direction. */
	canonicalIds: string[];
	/** Ordered priority tiers. Earlier tiers have higher priority (lower rank). */
	priorityTiers: Array<{
		rank: number;
		tier: "workspace" | "execution" | "governance" | "adapters" | "supervision" | "history";
		specIds: string[];
	}>;
}

/**
 * Default configuration extracted from the previous hardcoded constants.
 * This serves as the baseline; workspaces can override via a config file.
 */
export const DEFAULT_CATALOG_CONFIG: SpecCatalogConfig = {
	consolidationTargets: {
		"design-system": "design-system-v2",
		"pitagoras-ux": "design-system-v2",
		"ds-catalog": "design-system-v2",
		"design-system-v2-patterns": "design-system-v2",
		"adapter-alerts": "adapter-platform-v2",
		"adapter-claude-code": "adapter-platform-v2",
		"adapter-codex-cli": "adapter-platform-v2",
		"adapter-cursor": "adapter-platform-v2",
		"adapter-hermes": "adapter-platform-v2",
		"adapter-opencode": "adapter-platform-v2",
		"adapter-vscode": "adapter-platform-v2",
		"adapter-windsurf": "adapter-platform-v2",
		"harness-agent-direction": "adapter-platform-v2",
		"architecture-convergence": "architecture-agnostic",
	},
	canonicalIds: [
		"activity-context",
		"architecture-agnostic",
		"adapter-platform-v2",
		"design-system-v2",
		"agent-orchestration",
		"agent-identity",
		"external-executor-protocol",
		"semiautonomous-flow",
		"canonical-operation-gateway",
		"durable-execution-leases",
		"idempotent-runtime-projections",
		"protocol-conformance-reference",
		"security-review-scoped",
		"supervision-signals",
		"tool-adapters",
		"launch-site",
		"spec-governance-hygiene",
	],
	priorityTiers: [
		{ rank: 1, tier: "workspace", specIds: ["canonical-workspace-integrity", "harness-schema-validation", "spec-frontmatter", "canonical-operation-gateway"] },
		{ rank: 2, tier: "execution", specIds: ["durable-execution-leases", "idempotent-runtime-projections", "protocol-conformance-reference", "external-executor-protocol", "semiautonomous-flow"] },
		{ rank: 3, tier: "governance", specIds: ["security-review-scoped", "supervision-signals", "agent-orchestration", "agent-identity"] },
		{ rank: 4, tier: "adapters", specIds: ["adapter-platform-v2", "tool-adapters", "architecture-agnostic"] },
		{ rank: 5, tier: "supervision", specIds: ["activity-context", "design-system-v2", "launch-site"] },
	],
};
