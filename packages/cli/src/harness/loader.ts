import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSimpleYaml } from "./parse";
import type { HarnessManifest, StageDef } from "./types";

export function resolveHarnessRoot(cwd: string, version = "v0.1.0"): string {
	const candidates = [
		join(cwd, ".letra", "harness", version),
		join(cwd, "..", ".letra", "harness", version),
	];
	for (const p of candidates) {
		if (existsSync(p)) return p;
	}
	return candidates[0];
}

function unwrapStages(value: unknown): any[] {
	if (Array.isArray(value)) return value;
	if (value && typeof value === "object" && Array.isArray((value as any).stages)) return (value as any).stages;
	return [];
}

export function loadHarness(root: string): HarnessManifest | null {
	const harnessDir = root;
	if (!existsSync(harnessDir)) return null;

	const flowsDir = join(harnessDir, "flows");
	const gatesDir = join(harnessDir, "gates");
	const rolesDir = join(harnessDir, "roles");
	const policiesDir = join(harnessDir, "policies");

	if (!existsSync(flowsDir) || !existsSync(gatesDir) || !existsSync(rolesDir)) return null;

	const flows: Record<string, HarnessManifest["flows"][string]> = {};
	if (existsSync(flowsDir)) {
		for (const file of readdirSync(flowsDir)) {
			if (!file.endsWith(".yaml")) continue;
			const raw = parseSimpleYaml(readFileSync(join(flowsDir, file), "utf-8"));
			flows[String(raw.id)] = {
				id: String(raw.id),
				version: String(raw.version ?? "0.0.0"),
				name: String(raw.name ?? raw.id),
				description: String(raw.description ?? ""),
				defaultPolicy: String(raw.defaultPolicy ?? ""),
				stages: unwrapStages(raw.stages).map((s: any) => ({
					id: String(s.id ?? ""),
					name: String(s.name ?? s.id ?? ""),
					order: typeof s.order === "number" ? s.order : Number(s.order ?? 0),
					zone: ["todo", "doing", "done"].includes(s.zone)
						? (s.zone as StageDef["zone"])
						: undefined,
					description: String(s.description ?? ""),
					agents: Array.isArray(s.agents)
						? s.agents.map((a: any) => String(a))
						: typeof s.agents === "string"
							? s.agents.split(",").map((a: string) => a.trim()).filter(Boolean)
							: [],
					gate: typeof s.gate === "string" && s.gate.trim() ? s.gate.trim() : null,
				})),
			};
		}
	}

	const gates: Record<string, HarnessManifest["gates"][string]> = {};
	if (existsSync(gatesDir)) {
		for (const file of readdirSync(gatesDir)) {
			if (!file.endsWith(".yaml")) continue;
			const raw = parseSimpleYaml(readFileSync(join(gatesDir, file), "utf-8"));
			gates[String(raw.id)] = {
				id: String(raw.id),
				name: String(raw.name ?? raw.id),
				type: ["human", "automated", "external"].includes(raw.type as string)
					? (raw.type as HarnessManifest["gates"][string]["type"])
					: "automated",
				blocking: raw.blocking === true,
				policyRef: (raw.policyRef as string | undefined) ?? undefined,
				description: String(raw.description ?? ""),
			};
		}
	}

	const roles: Record<string, HarnessManifest["roles"][string]> = {};
	if (existsSync(rolesDir)) {
		for (const file of readdirSync(rolesDir)) {
			if (!file.endsWith(".yaml")) continue;
			const raw = parseSimpleYaml(readFileSync(join(rolesDir, file), "utf-8"));
			const capabilities = Array.isArray(raw.capabilities)
				? raw.capabilities.map(String)
				: typeof raw.capabilities === "string"
					? raw.capabilities.split(",").map((a: string) => a.trim()).filter(Boolean)
					: [];
			roles[String(raw.id)] = {
				id: String(raw.id),
				label: String(raw.label ?? raw.id),
				description: String(raw.description ?? ""),
				allowedStages: Array.isArray(raw.allowedStages)
					? raw.allowedStages.map(String)
					: typeof raw.allowedStages === "string"
						? raw.allowedStages.split(",").map((a: string) => a.trim()).filter(Boolean)
						: [],
				capabilities,
			};
		}
	}

	const policies: Record<string, HarnessManifest["policies"][string]> = {};
	if (existsSync(policiesDir)) {
		for (const file of readdirSync(policiesDir)) {
			if (!file.endsWith(".json")) continue;
			try {
				const p = JSON.parse(readFileSync(join(policiesDir, file), "utf-8"));
				policies[String(p.id)] = p as HarnessManifest["policies"][string];
			} catch {
				// ignore malformed policy
			}
		}
	}

	return {
		version: "0.1.0",
		flows,
		gates,
		roles,
		policies,
	};
}
