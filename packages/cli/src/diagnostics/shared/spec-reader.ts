import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const AC_PENDING = /-\s\[ \]\s\*\*`([^`]+)`\*\*/g;
const AC_DONE = /-\s\[x\]\s\*\*`([^`]+)`\*\*/g;

export interface SpecACs {
	pending: number;
	done: number;
	total: number;
}

export function loadSpecDirs(specsDir: string): string[] {
	if (!existsSync(specsDir)) return [];
	return readdirSync(specsDir, { withFileTypes: true })
		.filter((d) => d.isDirectory() && !d.name.startsWith("_"))
		.map((d) => d.name);
}

export function parseACs(content: string): SpecACs {
	const pending = [...content.matchAll(AC_PENDING)].length;
	const done = [...content.matchAll(AC_DONE)].length;
	if (pending > 0 || done > 0) {
		return { pending, done, total: pending + done };
	}
	const genericPending = content.match(/^- \[ \]/gm) || [];
	const genericDone = content.match(/^- \[[xX]\]/gm) || [];
	return { pending: genericPending.length, done: genericDone.length, total: genericPending.length + genericDone.length };
}

export function countACs(specDir: string): SpecACs {
	const acceptanceFile = join(specDir, "acceptance.md");
	const specFile = join(specDir, "spec.md");

	if (existsSync(acceptanceFile)) {
		const content = readFileSync(acceptanceFile, "utf-8");
		return parseACs(content);
	}
	if (existsSync(specFile)) {
		const content = readFileSync(specFile, "utf-8");
		return parseACs(content);
	}
	return { pending: 0, done: 0, total: 0 };
}
