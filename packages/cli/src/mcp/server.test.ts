import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { createLetraMcpServer } from "./server.js";
import { loadSessionLog } from "../session-log.js";

const roots: string[] = [];

function fixture(): string {
	const root = mkdtempSync(join(tmpdir(), "letra-mcp-"));
	roots.push(root);
	mkdirSync(join(root, ".letra", "specs", "live-direction"), { recursive: true });
	writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify({
		version: "1.0",
		name: "MCP fixture",
		createdAt: "2026-07-04T00:00:00.000Z",
		updatedAt: "2026-07-04T00:00:00.000Z",
		template: "missing-template",
		harnessVersion: "missing-version",
		stages: [
			{ id: "build", name: "Build", order: 0, zone: "doing" },
			{ id: "review", name: "Review", order: 1, zone: "doing" },
		],
		items: [{
			id: "ITEM-1",
			description: "Live direction",
			stage: "build",
			spec: "live-direction",
			createdAt: "2026-07-04T00:00:00.000Z",
		}],
		tools: ["codex"],
	}, null, 2));
	writeFileSync(
		join(root, ".letra", "specs", "live-direction", "spec.md"),
		"# Spec\n\n## Acceptance Criteria\n- [ ] **AC1 — Live**: expose current direction\n",
	);
	writeFileSync(
		join(root, ".letra", "constitution.md"),
		"# Constitution\n\nHarness is authority.\n",
	);
	return root;
}

function toolJson(result: Awaited<ReturnType<Client["callTool"]>>): Record<string, unknown> {
	const content = (result as { content: Array<{ type: string; text?: string }> }).content;
	const text = content.find((entry) => entry.type === "text");
	if (!text?.text) throw new Error("Tool did not return text.");
	return JSON.parse(text.text);
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Letra MCP read-only server", () => {
	it("exposes direction, active spec and health through tools and resources", async () => {
		const root = fixture();
		const server = createLetraMcpServer(root);
		const client = new Client({ name: "letra-test", version: "1.0.0" });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await server.connect(serverTransport);
		await client.connect(clientTransport);

		try {
			const tools = await client.listTools();
			expect(tools.tools.map((tool) => tool.name)).toEqual([
				"get_direction",
				"get_active_spec",
				"get_health",
				"validate",
				"complete_ac",
				"request_transition",
				"list_gates",
				"list_roles",
			]);
			expect(tools.tools.filter((tool) => tool.annotations?.readOnlyHint === true).length).toBe(5);
			expect(tools.tools.filter((tool) => tool.annotations?.readOnlyHint === false).length).toBe(3);
			expect(tools.tools.filter(
				(tool) => tool.inputSchema?.additionalProperties === false,
			).length).toBe(3);

			const direction = toolJson(await client.callTool({ name: "get_direction", arguments: {} }));
			expect(direction.item).toMatchObject({ id: "ITEM-1", stage: "build" });
			expect(direction.revision).toMatch(/^sha256:/);

		const spec = toolJson(await client.callTool({ name: "get_active_spec", arguments: {} }));
		expect(spec).toMatchObject({ name: "live-direction" });

			const health = toolJson(await client.callTool({ name: "get_health", arguments: {} }));
			expect(health).toMatchObject({ active: [] });

			const resources = await client.listResources();
			expect(resources.resources.map((resource) => resource.uri)).toEqual([
				"letra://direction",
				"letra://spec/active",
				"letra://constitution",
				"letra://health",
				"letra://harness/templates",
				"letra://harness/gates",
				"letra://harness/roles",
			]);
			const resourceTemplates = await client.listResourceTemplates();
			expect(resourceTemplates.resourceTemplates.map((rt) => rt.uriTemplate)).toEqual([
				"letra://harness/templates/{flowId}",
			]);

			const rawContent = (await client.readResource({ uri: "letra://harness/gates" })).contents[0];
			if (!("text" in rawContent) || typeof rawContent.text !== "string") {
				throw new Error("Expected text content for harness/gates");
			}
			const gates = JSON.parse(rawContent.text);
			expect(gates).toEqual([]);

			const rawRoles = (await client.readResource({ uri: "letra://harness/roles" })).contents[0];
			if (!("text" in rawRoles) || typeof rawRoles.text !== "string") {
				throw new Error("Expected text content for harness/roles");
			}
			const roles = JSON.parse(rawRoles.text);
			expect(roles).toEqual([]);

			const rawTemplates = (await client.readResource({ uri: "letra://harness/templates" })).contents[0];
			if (!("text" in rawTemplates) || typeof rawTemplates.text !== "string") {
				throw new Error("Expected text content for harness/templates");
			}
			const templates = JSON.parse(rawTemplates.text);
			expect(Array.isArray(templates)).toBe(true);

			const constitution = await client.readResource({ uri: "letra://constitution" });
			expect(constitution.contents[0]).toMatchObject({
				uri: "letra://constitution",
				text: expect.stringContaining("Harness is authority"),
			});
		} finally {
			await client.close();
			await server.close();
		}
	});

	it("applies controlled mutations with evidence, revision checks and audit IDs", async () => {
		const root = fixture();
		const server = createLetraMcpServer(root);
		const client = new Client({ name: "letra-test", version: "1.0.0" });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await server.connect(serverTransport);
		await client.connect(clientTransport);

		try {
			const direction = toolJson(await client.callTool({ name: "get_direction", arguments: {} }));
			const rejected = toolJson(await client.callTool({
				name: "complete_ac",
				arguments: {
					acId: "AC1",
					expectedRevision: direction.revision,
					evidence: [],
					reason: "No evidence.",
				},
			}));
			expect(rejected).toMatchObject({
				outcome: "rejected",
				reasonCode: "REGRESSION_EVIDENCE_REQUIRED",
			});

			const completed = toolJson(await client.callTool({
				name: "complete_ac",
				arguments: {
					acId: "AC1",
					expectedRevision: direction.revision,
					evidence: ["MCP contract test passed"],
					reason: "Criterion verified.",
				},
			}));
			expect(completed).toMatchObject({
				outcome: "accepted",
				reasonCode: "AC_COMPLETED",
				auditId: expect.stringMatching(/^log-/),
			});

			const transitioned = toolJson(await client.callTool({
				name: "request_transition",
				arguments: {
					itemId: "ITEM-1",
					targetStageId: "review",
					expectedRevision: completed.afterRevision,
					reason: "Request review.",
				},
			}));
			expect(transitioned).toMatchObject({
				outcome: "accepted",
				reasonCode: "TRANSITION_COMPLETED",
				nextDirection: expect.objectContaining({
					item: expect.objectContaining({ stage: "review" }),
				}),
			});
			const mutationEntries = loadSessionLog(root).entries.filter(
				(entry) => entry.action === "agent_ac_completion_requested"
					|| entry.action === "agent_transition_requested",
			);
			expect(mutationEntries).toHaveLength(2);
			expect(mutationEntries.every((entry) => (
				entry.details.by === "mcp:letra-test"
					&& entry.details.outcome === "accepted"
					&& typeof entry.details.reasonCode === "string"
					&& typeof entry.timestamp === "string"
					&& entry.description.length > 0
			))).toBe(true);
		} finally {
			await client.close();
			await server.close();
		}
	});

	it("returns a new revision after canonical state changes in the same session", async () => {
		const root = fixture();
		const server = createLetraMcpServer(root);
		const client = new Client({ name: "letra-test", version: "1.0.0" });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await server.connect(serverTransport);
		await client.connect(clientTransport);

		try {
			const before = toolJson(await client.callTool({ name: "get_direction", arguments: {} }));
			const workflowPath = join(root, ".letra", "workflow.json");
			const workflow = JSON.parse(readFileSync(workflowPath, "utf-8"));
			workflow.items[0].stage = "review";
			workflow.updatedAt = "2026-07-04T01:00:00.000Z";
			writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));

			const after = toolJson(await client.callTool({ name: "get_direction", arguments: {} }));

			expect(after.item).toMatchObject({ id: "ITEM-1", stage: "review" });
			expect(after.revision).not.toBe(before.revision);
		} finally {
			await client.close();
			await server.close();
		}
	});

	it("audits relevant reads once per unchanged revision in the same session", async () => {
		const root = fixture();
		const server = createLetraMcpServer(root);
		const client = new Client({ name: "audit-client", version: "1.0.0" });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await server.connect(serverTransport);
		await client.connect(clientTransport);

		try {
			await client.callTool({ name: "get_direction", arguments: {} });
			await client.callTool({ name: "get_direction", arguments: {} });
			await client.callTool({ name: "get_active_spec", arguments: {} });

			const reads = loadSessionLog(root).entries.filter(
				(entry) => entry.action === "agent_direction_read",
			);
			expect(reads).toHaveLength(2);
			expect(reads.map((entry) => entry.details.resource)).toEqual([
				"direction",
				"active-spec",
			]);
			expect(reads.every((entry) => (
				entry.details.by === "mcp:audit-client"
				&& entry.details.outcome === "accepted"
				&& typeof entry.details.revision === "string"
			))).toBe(true);
		} finally {
			await client.close();
			await server.close();
		}
	});

	it("returns empty constitution when file does not exist", async () => {
		const root = mkdtempSync(join(tmpdir(), "letra-mcp-no-constitution-"));
		roots.push(root);
		mkdirSync(join(root, ".letra", "specs", "live-direction"), { recursive: true });
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify({
			version: "1.0",
			name: "MCP fixture",
			createdAt: "2026-07-04T00:00:00.000Z",
			updatedAt: "2026-07-04T00:00:00.000Z",
			template: "missing-template",
			harnessVersion: "missing-version",
			stages: [{ id: "build", name: "Build", order: 0 }],
			items: [{
				id: "ITEM-1",
				description: "Live direction",
				stage: "build",
				spec: "live-direction",
				createdAt: "2026-07-04T00:00:00.000Z",
			}],
			tools: ["codex"],
		}, null, 2));
		writeFileSync(
			join(root, ".letra", "specs", "live-direction", "spec.md"),
			"# Spec\n\n## Acceptance Criteria\n- [ ] **AC1 — Live**: expose current direction\n",
		);

		const server = createLetraMcpServer(root);
		const client = new Client({ name: "letra-test", version: "1.0.0" });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await server.connect(serverTransport);
		await client.connect(clientTransport);

		try {
			const constitution = await client.readResource({ uri: "letra://constitution" });
			expect(constitution.contents[0]).toMatchObject({
				uri: "letra://constitution",
				text: "",
			});
		} finally {
			await client.close();
			await server.close();
		}
	});

	it("logs constitution_read when reading constitution resource", async () => {
		const root = fixture();
		const server = createLetraMcpServer(root);
		const client = new Client({ name: "letra-test", version: "1.0.0" });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await server.connect(serverTransport);
		await client.connect(clientTransport);

		try {
			await client.readResource({ uri: "letra://constitution" });
			const log = loadSessionLog(root);
			const constitutionReads = log.entries.filter(
				(entry) => entry.action === "constitution_read",
			);
			expect(constitutionReads.length).toBeGreaterThanOrEqual(1);
			expect(constitutionReads[0].details).toMatchObject({
				adapter: "mcp",
				available: true,
			});
		} finally {
			await client.close();
			await server.close();
		}
	});

	it("reads constitution version from file with version header", async () => {
		const root = mkdtempSync(join(tmpdir(), "letra-mcp-version-"));
		roots.push(root);
		mkdirSync(join(root, ".letra", "specs", "live-direction"), { recursive: true });
		writeFileSync(join(root, ".letra", "workflow.json"), JSON.stringify({
			version: "1.0",
			name: "MCP fixture",
			createdAt: "2026-07-04T00:00:00.000Z",
			updatedAt: "2026-07-04T00:00:00.000Z",
			template: "missing-template",
			harnessVersion: "missing-version",
			stages: [{ id: "build", name: "Build", order: 0 }],
			items: [{
				id: "ITEM-1",
				description: "Live direction",
				stage: "build",
				spec: "live-direction",
				createdAt: "2026-07-04T00:00:00.000Z",
			}],
			tools: ["codex"],
		}, null, 2));
		writeFileSync(
			join(root, ".letra", "specs", "live-direction", "spec.md"),
			"# Spec\n\n## Acceptance Criteria\n- [ ] **AC1 — Live**: expose current direction\n",
		);
		writeFileSync(
			join(root, ".letra", "constitution.md"),
			"# Constitution\n\n**Version:** 2.0.0\n\nHarness is authority.\n",
		);

		const server = createLetraMcpServer(root);
		const client = new Client({ name: "letra-test", version: "1.0.0" });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await server.connect(serverTransport);
		await client.connect(clientTransport);

		try {
			const constitution = await client.readResource({ uri: "letra://constitution" });
			expect(constitution.contents[0]).toMatchObject({
				uri: "letra://constitution",
				text: expect.stringContaining("**Version:** 2.0.0"),
			});

			const log = loadSessionLog(root);
			const constitutionReads = log.entries.filter(
				(entry) => entry.action === "constitution_read",
			);
			expect(constitutionReads[0].details).toMatchObject({
				available: true,
				version: "2.0.0",
			});
		} finally {
			await client.close();
			await server.close();
		}
	});

	it("rejects malformed mutation input at the MCP schema boundary", async () => {
		const root = fixture();
		const server = createLetraMcpServer(root);
		const client = new Client({ name: "schema-client", version: "1.0.0" });
		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		await server.connect(serverTransport);
		await client.connect(clientTransport);

		try {
			const response = await client.callTool({
				name: "request_transition",
				arguments: {
					itemId: "../../outside",
					targetStageId: "../review",
					expectedRevision: "not-a-revision",
					reason: "",
					command: "Remove-Item -Recurse",
				},
			});
			expect(response.isError).toBe(true);
			expect(readFileSync(join(root, ".letra", "workflow.json"), "utf-8")).toContain(
				'"stage": "build"',
			);
		} finally {
			await client.close();
			await server.close();
		}
	});
});
