import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { queryLog } from "../session-log.js";
import type { Item } from "../commands/flow-init.js";
import { getLetraDir } from "./../workspace/resolver.js";
import type { Gate, HarnessManifest } from "./types.js";
import { parseSimpleYaml } from "./parse.js";
import { resolveHarnessRoot, DEFAULT_HARNESS_VERSION } from "./loader.js";

export interface GateResult {
	allowed: boolean;
	reason?: string;
	blocksHandoff?: boolean;
}

interface GateRuntimeStatus {
	blocksHandoff: boolean;
	status: string;
}

function loadGateStatusFromDisk(root: string, gateId: string): GateRuntimeStatus | null {
	const candidates = [
		join(getLetraDir(root), "harness", "gates"),
		join(root, ".letra", "harness", "gates"),
	];
	for (const gatesDir of candidates) {
		if (!existsSync(gatesDir)) continue;
		const files = [join(gatesDir, `${gateId}.yaml`), join(gatesDir, `${gateId}.yml`)];
		for (const f of files) {
			if (existsSync(f)) {
				const raw = parseSimpleYaml(readFileSync(f, "utf-8"));
				return {
					blocksHandoff: raw.blocksHandoff === true,
					status: raw.status === "approved" ? "approved" : "pending",
				};
			}
		}
	}
	return null;
}

function loadManifestGates(root: string): Record<string, Gate> {
	const candidates = [
		join(getLetraDir(root), "harness", DEFAULT_HARNESS_VERSION),
		join(resolveHarnessRoot(root, DEFAULT_HARNESS_VERSION)),
	];
	const gates: Record<string, Gate> = {};
	for (const harnessDir of candidates) {
		const gatesDir = join(harnessDir, "gates");
		if (!existsSync(gatesDir)) continue;
		for (const file of readdirSync(gatesDir)) {
			if (!file.endsWith(".yaml")) continue;
			try {
				const raw = parseSimpleYaml(readFileSync(join(gatesDir, file), "utf-8"));
				const id = String(raw.id ?? file.replace(/\.ya?ml$/, ""));
				gates[id] = {
					id,
					name: String(raw.name ?? id),
					type: ["human", "automated", "external"].includes(raw.type as string)
						? (raw.type as Gate["type"])
						: "automated",
					blocking: raw.blocking === true,
					blocksHandoff: raw.blocksHandoff === true,
					policyRef: typeof raw.policyRef === "string" ? raw.policyRef : undefined,
					description: String(raw.description ?? ""),
					decisions:
						raw.decisions && typeof raw.decisions === "object"
							? Object.fromEntries(
									Object.entries(raw.decisions as Record<string, unknown>)
										.filter(
											([, v]) =>
												typeof v === "string" && (v as string).trim(),
										)
										.map(([k, v]) => [k, (v as string).trim()]),
								)
							: undefined,
				};
			} catch {
				// ignore malformed gate file
			}
		}
		if (Object.keys(gates).length > 0) break;
	}
	return gates;
}

export class GateChecker {
	private readonly root: string;
	private readonly manifestGates: Record<string, Gate>;

	constructor(root: string, manifest?: HarnessManifest) {
		this.root = root;
		this.manifestGates = manifest?.gates ?? loadManifestGates(root);
	}

	private getGate(gateId: string): Gate | undefined {
		return this.manifestGates[gateId];
	}

	private getRuntimeStatus(gateId: string): GateRuntimeStatus | null {
		return loadGateStatusFromDisk(this.root, gateId);
	}

	checkBlocksHandoff(gateId: string): boolean {
		const gate = this.getGate(gateId);
		if (gate) return gate.blocksHandoff === true;
		const status = this.getRuntimeStatus(gateId);
		if (status) return status.blocksHandoff;
		return false;
	}

	checkHandoffAllowed(gateId: string, item: Item): GateResult {
		if (!gateId) return { allowed: true };
		const blocksHandoff = this.checkBlocksHandoff(gateId);

		if (!blocksHandoff) {
			return { allowed: true };
		}

		const gateResult = this.check(gateId, item);
		if (!gateResult.allowed) {
			return {
				...gateResult,
				blocksHandoff: true,
			};
		}

		const runtime = this.getRuntimeStatus(gateId);
		if (runtime && runtime.status !== "approved") {
			return {
				allowed: false,
				reason: `Gate "${gateId}" blocks handoff and is not approved`,
				blocksHandoff: true,
			};
		}
		return { allowed: true };
	}

	check(gateId: string, item: Item): GateResult {
		const gate = this.getGate(gateId);

		if (!gate) {
			return this.checkByConvention(gateId, item);
		}

		switch (gate.type) {
			case "human":
				return this.checkHumanGate(gate);
			case "automated":
				return this.checkAutomatedGate(gate, item);
			case "external":
				return this.checkExternalGate(gate);
			default:
				return { allowed: true };
		}
	}

	private checkByConvention(gateId: string, item: Item): GateResult {
		if (gateId === "has-spec-file") return this.checkHasSpecFile(item);
		if (gateId === "all-acs-passing") return this.checkAllAcsPassing(item);
		return { allowed: true };
	}

	private checkHumanGate(gate: Gate): GateResult {
		const runtime = this.getRuntimeStatus(gate.id);
		if (!runtime) {
			return { allowed: false, reason: `Gate "${gate.id}" não encontrado` };
		}
		if (runtime.status !== "approved") {
			const decisionLabel = gate.decisions?.approve ?? "aprovação";
			return { allowed: false, reason: `Gate "${gate.id}" pendente de ${decisionLabel}` };
		}
		return { allowed: true };
	}

	private checkAutomatedGate(gate: Gate, item: Item): GateResult {
		if (gate.id === "has-spec-file") return this.checkHasSpecFile(item);
		if (gate.id === "all-acs-passing") return this.checkAllAcsPassing(item);
		const runtime = this.getRuntimeStatus(gate.id);
		if (!runtime) {
			return { allowed: false, reason: `Gate "${gate.id}" não encontrado` };
		}
		if (runtime.status !== "approved") {
			return { allowed: false, reason: `Gate "${gate.id}" pendente de aprovação` };
		}
		return { allowed: true };
	}

	private checkExternalGate(gate: Gate): GateResult {
		const runtime = this.getRuntimeStatus(gate.id);
		if (!runtime) {
			return { allowed: false, reason: `Gate "${gate.id}" não encontrado` };
		}
		if (runtime.status !== "approved") {
			return { allowed: false, reason: `Gate "${gate.id}" pendente de validação externa` };
		}
		return { allowed: true };
	}

	private checkHasSpecFile(item: Item): GateResult {
		if (!item.spec) {
			return { allowed: false, reason: "Item sem spec vinculada" };
		}
		const specDir = join(getLetraDir(this.root), "specs", item.spec);
		if (!existsSync(specDir)) {
			return { allowed: false, reason: `Pasta de spec não encontrada: ${item.spec}` };
		}
		return { allowed: true };
	}

	private checkAllAcsPassing(item: Item): GateResult {
		if (!item.spec) {
			return { allowed: false, reason: "Item sem spec vinculada" };
		}
		const specPath = join(getLetraDir(this.root), "specs", item.spec, "spec.md");
		if (!existsSync(specPath)) {
			return { allowed: false, reason: `Spec não encontrada: ${item.spec}` };
		}

		const content = readFileSync(specPath, "utf-8");
		const pending = (content.match(/^- \[ \]/gm) || []).length;
		if (pending > 0) {
			return {
				allowed: false,
				reason: `${pending} AC(s) pendente(s) em "${item.spec}"`,
			};
		}

		const done = (content.match(/^- \[[xX]\]/gm) || []).length;
		const logEntries = queryLog(this.root, {
			itemId: item.id,
			action: "ac_done",
			limit: 999,
		});
		if (done > logEntries.length) {
			return {
				allowed: false,
				reason: `${done - logEntries.length} AC(s) marcado(s) sem confirmação "ac done"`,
			};
		}

		return { allowed: true };
	}
}
