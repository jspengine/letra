import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { queryLog } from "../session-log.js";
import type { Item } from "../commands/flow-init.js";
import { getLetraDir } from "./../workspace/resolver.js";
import type { Gate, HarnessManifest } from "./types.js";
import type { GateCheckType } from "./types.js";
import { parseSimpleYaml } from "./parse.js";
import { resolveHarnessRoot, DEFAULT_HARNESS_VERSION } from "./loader.js";
import type { SecurityReviewReport } from "../security/scoped-review.js";
import { securityReportPath, securityReportFingerprint, validateSecurityReviewReport } from "../security/scoped-review.js";

export interface GateResult {
	allowed: boolean;
	reason?: string;
	reasonCode?: string;
	blocksHandoff?: boolean;
}

interface GateRuntimeStatus {
	blocksHandoff: boolean;
	status: string;
}

function loadGateStatusFromDisk(root: string, gateId: string): GateRuntimeStatus | null {
	const candidates = [
		join(getLetraDir(root), "harness", DEFAULT_HARNESS_VERSION, "gates"),
		// Keep compatibility with pre-v0.2 workspaces whose gate runtime
		// status lived directly under .letra/harness/gates.
		join(getLetraDir(root), "harness", "gates"),
		join(resolveHarnessRoot(root, DEFAULT_HARNESS_VERSION), "gates"),
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
					pre_check: typeof raw.pre_check === "string" ? raw.pre_check as GateCheckType : undefined,
					check_type: typeof raw.check_type === "string" ? raw.check_type as GateCheckType : undefined,
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
		if (!this.getGate(gateId) && !this.getRuntimeStatus(gateId)) {
			return { allowed: false, reasonCode: "GATE_NOT_FOUND", reason: `Gate "${gateId}" não encontrado`, blocksHandoff: true };
		}
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
			return { allowed: false, reasonCode: "GATE_NOT_FOUND", reason: `Gate "${gateId}" não encontrado` };
		}

		switch (gate.type) {
			case "human":
				return this.checkHumanGate(gate, item);
			case "automated":
				return this.checkAutomatedGate(gate, item);
			case "external":
				return this.checkExternalGate(gate);
			default:
				return { allowed: true };
		}
	}

	private checkHumanGate(gate: Gate, item?: Item): GateResult {
		if (gate.pre_check) {
			if (!item) return { allowed: false, reasonCode: "GATE_ITEM_REQUIRED", reason: `Gate "${gate.id}" exige item para executar pre_check.` };
			const preCheck = this.runDeclarativeCheck(gate.pre_check, item);
			if (!preCheck.allowed) return preCheck;
		}
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
		if (gate.check_type) return this.runDeclarativeCheck(gate.check_type, item);
		const runtime = this.getRuntimeStatus(gate.id);
		if (!runtime) {
			return { allowed: false, reasonCode: "GATE_CHECK_UNCONFIGURED", reason: `Gate automatizado "${gate.id}" não declara check_type nem possui status verificável.` };
		}
		if (runtime.status !== "approved") {
			return { allowed: false, reason: `Gate "${gate.id}" pendente de validação` };
		}
		return { allowed: true };
	}

	private runDeclarativeCheck(checkType: GateCheckType, item: Item): GateResult {
		if (checkType === "spec-linked") return this.checkHasSpecFile(item);
		if (checkType === "acceptance-complete") return this.checkAllAcsPassing(item);
		if (checkType === "validation") {
			const validation = item.validation;
			if (!validation || validation.schemaVersion !== "1") {
				return { allowed: false, reasonCode: "VALIDATION_EVIDENCE_MISSING", reason: "O gate exige uma validação canônica vigente para este item." };
			}
			if (validation.outcome === "rejected") {
				return { allowed: false, reasonCode: "VALIDATION_REJECTED", reason: "A última validação canônica do item falhou." };
			}
			const expiresAt = Date.parse(validation.expiresAt);
			if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
				return { allowed: false, reasonCode: "VALIDATION_EVIDENCE_EXPIRED", reason: "A validação canônica do item venceu; execute validate novamente." };
			}
			return { allowed: true };
		}
		if (checkType === "security-scoped") return this.checkScopedSecurityGate(item);
		return { allowed: false, reasonCode: "GATE_CHECK_UNSUPPORTED", reason: `Check declarativo "${String(checkType)}" não é suportado.` };
	}

	private checkScopedSecurityGate(item: Item): GateResult {
		const persistedReport = this.readSecurityReport(item.id);
		const report = item.securityReview ?? persistedReport;
		if (!report) {
			return {
				allowed: false,
				reasonCode: "SECURITY_REVIEW_REQUIRED",
				reason: "A revisão de Security escopada deste item ainda não foi executada.",
			};
		}
		if (persistedReport && item.securityReview && persistedReport.reportFingerprint !== item.securityReview.reportFingerprint) {
			return {
				allowed: false,
				reasonCode: "SECURITY_REVIEW_REQUIRED",
				reason: "O relatório incorporado no item diverge do relatório persistido; execute uma nova revisão.",
			};
		}
		if (report.schemaVersion !== "1" || !report.context?.baseline?.capturedAt) {
			return {
				allowed: false,
				reasonCode: "SECURITY_BASELINE_INVALID",
				reason: "A revisão de Security não possui um baseline reproduzível válido.",
			};
		}
		if (!report.reportFingerprint || report.reportFingerprint !== securityReportFingerprint(report)) {
			return {
				allowed: false,
				reasonCode: "SECURITY_REVIEW_REQUIRED",
				reason: "A integridade do relatório de Security não pôde ser verificada; execute uma nova revisão.",
			};
		}
		const validity = validateSecurityReviewReport(this.root, item, report);
		if (!validity.ok) return { allowed: false, reasonCode: validity.reasonCode, reason: validity.reason };
		if (report.reasonCode === "SECURITY_SCAN_FAILED" || report.decision === "needs-review" || (report.scanErrors?.length ?? 0) > 0) {
			return {
				allowed: false,
				reasonCode: report.reasonCode === "SECURITY_REVIEW_REQUIRED" ? "SECURITY_REVIEW_REQUIRED" : "SECURITY_SCAN_FAILED",
				reason: report.scanErrors?.join("; ") || (report.reasonCode === "SECURITY_REVIEW_REQUIRED" ? "A revisão de Security não demonstrou o caminho causal da dependência; revisão adicional necessária." : "A revisão de Security não conseguiu concluir todos os scanners."),
			};
		}
		if (!Array.isArray(report.scannerEvidence) || report.scannerEvidence.length === 0 || report.scannerEvidence.some((scanner) => scanner.outcome !== "completed" || !scanner.command || !scanner.version || !Array.isArray(scanner.scope))) {
			return {
				allowed: false,
				reasonCode: "SECURITY_SCAN_FAILED",
				reason: "A revisão de Security não registrou evidência completa de todos os scanners executados.",
			};
		}
		if (report.blockingFindings.length > 0 || report.decision === "blocked") {
			return {
				allowed: false,
				reasonCode: "SECURITY_SCOPED_BLOCKED",
				reason: `${report.blockingFindings.length} achado(s) introduzido(s), relacionado(s), alcançável(is) e bloqueante(s) impedem o avanço.`,
			};
		}
		return { allowed: true, reasonCode: "SECURITY_SCOPED_CLEAR" };
	}

	private readSecurityReport(itemId: string): SecurityReviewReport | null {
		const path = securityReportPath(this.root, itemId);
		if (!existsSync(path)) return null;
		try {
			const report = JSON.parse(readFileSync(path, "utf8")) as SecurityReviewReport;
			return report && typeof report === "object" ? report : null;
		} catch {
			return null;
		}
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
