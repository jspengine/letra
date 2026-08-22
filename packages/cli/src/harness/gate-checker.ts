import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { queryLog } from "../session-log.js";
import type { Item } from "../commands/flow-init.js";
import { getLetraDir } from "./../workspace/resolver.js";

export interface GateResult {
	allowed: boolean;
	reason?: string;
	blocksHandoff?: boolean;
}

function loadGateStatus(root: string, gateId: string): { blocking: boolean; status: string; blocksHandoff: boolean } | null {
	const harnessDir = join(getLetraDir(root), "harness");
	if (!existsSync(harnessDir)) return null;
	const files = [join(harnessDir, "gates", `${gateId}.yaml`), join(harnessDir, "gates", `${gateId}.yml`)];
	for (const f of files) {
		if (existsSync(f)) {
			const raw = readFileSync(f, "utf-8");
			const blocking = raw.includes("blocking: true");
			const blocksHandoff = raw.includes("blocksHandoff: true");
			const status = raw.includes("status: approved") ? "approved" : "pending";
			return { blocking, status, blocksHandoff };
		}
	}
	return null;
}

export class GateChecker {
	constructor(private readonly root: string) {}

	checkBlocksHandoff(gateId: string): boolean {
		const status = loadGateStatus(this.root, gateId);
		if (!status) return false;
		return status.blocksHandoff;
	}

	check(gateId: string, item: Item): GateResult {
		switch (gateId) {
			case "has-spec-file":
				return this.checkHasSpecFile(item);
			case "all-acs-passing":
				return this.checkAllAcsPassing(item);
			case "human-approved-code":
			case "human-approved-spec":
				return this.checkHumanApproved(gateId);
			case "security-clear":
				return this.checkSecurityClear(item);
			default:
				return { allowed: true };
		}
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

	private checkHumanApproved(gateId: string): GateResult {
		const status = loadGateStatus(this.root, gateId);
		if (!status) {
			return { allowed: false, reason: `Gate "${gateId}" não encontrado` };
		}
		if (status.status !== "approved") {
			return { allowed: false, reason: `Gate "${gateId}" pendente de aprovação humana` };
		}
		return { allowed: true };
	}

	private checkSecurityClear(_item: Item): GateResult {
		const status = loadGateStatus(this.root, "security-clear");
		if (!status) {
			return { allowed: false, reason: 'Gate "security-clear" não encontrado' };
		}
		if (status.status !== "approved") {
			return { allowed: false, reason: 'Gate "security-clear" pendente de aprovação' };
		}
		return { allowed: true };
	}
}
