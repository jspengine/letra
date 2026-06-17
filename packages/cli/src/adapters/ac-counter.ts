import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ACCount {
	pending: number;
	total: number;
	specCount: number;
	acceptanceCount: number;
	drift: boolean;
}

const PENDING_PATTERN = /-\s*\[ \]\s*\*\*(.+?)\*\*/g;
const DONE_PATTERN = /-\s*\[[xX]\]\s*\*\*(.+?)\*\*/g;

function countInText(text: string): { pending: number; total: number } {
	const boldPending = text.match(PENDING_PATTERN) || [];
	const boldDone = text.match(DONE_PATTERN) || [];
	if (boldPending.length > 0 || boldDone.length > 0) {
		return { pending: boldPending.length, total: boldPending.length + boldDone.length };
	}
	const genericPending = text.match(/^- \[ \]/gm) || [];
	const genericDone = text.match(/^- \[[xX]\]/gm) || [];
	return { pending: genericPending.length, total: genericPending.length + genericDone.length };
}

export function countACs(specDir: string): ACCount {
	const acceptanceFile = join(specDir, "acceptance.md");
	const specFile = join(specDir, "spec.md");

	let acceptancePending = 0;
	let acceptanceTotal = 0;
	let specPending = 0;
	let specTotal = 0;

	let hasAcceptance = false;
	let hasSpec = false;

	if (existsSync(acceptanceFile)) {
		hasAcceptance = true;
		const content = readFileSync(acceptanceFile, "utf-8");
		const counts = countInText(content);
		acceptancePending = counts.pending;
		acceptanceTotal = counts.total;
	}

	if (existsSync(specFile)) {
		hasSpec = true;
		const content = readFileSync(specFile, "utf-8");
		const match = content.match(/## Acceptance Criteria\s+([\s\S]*?)(?=\n## |\n*$)/);
		const sectionContent = match ? match[1] : "";
		const counts = countInText(sectionContent);
		specPending = counts.pending;
		specTotal = counts.total;
	}

	const drift = hasAcceptance && hasSpec && acceptanceTotal !== specTotal;

	if (hasAcceptance) {
		return {
			pending: acceptancePending,
			total: acceptanceTotal,
			specCount: specTotal,
			acceptanceCount: acceptanceTotal,
			drift,
		};
	}

	return {
		pending: specPending,
		total: specTotal,
		specCount: specTotal,
		acceptanceCount: 0,
		drift: false,
	};
}
