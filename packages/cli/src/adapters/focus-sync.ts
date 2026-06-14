import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface FocusData {
	specName: string;
	itemId: string;
	outcome: string;
}

export function extractOutcome(rootDir: string, specName: string): string | null {
	const specFile = join(rootDir, ".letra", "specs", specName, "spec.md");
	if (!existsSync(specFile)) return null;
	const content = readFileSync(specFile, "utf-8");
	const match = content.match(/## Outcome\s+([\s\S]*?)(?=\n## |\n*$)/);
	return match ? match[1].trim() : null;
}

export function writeFocusFile(rootDir: string, specName: string, itemId: string): void {
	const focusFile = join(rootDir, ".letra", "focus.md");
	const outcome = extractOutcome(rootDir, specName) || specName;
	const content = [
		`# Focus: ${specName}`,
		"",
		`**Path**: .letra/specs/${specName}/`,
		`**Item**: ${itemId}`,
		`**Outcome**: ${outcome}`,
		"",
	].join("\n");

	writeFileSync(focusFile, content, "utf-8");
}

export function clearFocusFile(rootDir: string): void {
	const focusFile = join(rootDir, ".letra", "focus.md");
	if (existsSync(focusFile)) {
		unlinkSync(focusFile);
	}
}

export function readFocusFile(rootDir: string): FocusData | null {
	const focusFile = join(rootDir, ".letra", "focus.md");
	if (!existsSync(focusFile)) return null;

	const content = readFileSync(focusFile, "utf-8");
	const specMatch = content.match(/# Focus:\s*(.+)/);
	const itemMatch = content.match(/\*\*Item\*\*:\s*(.+)/);
	const outcomeMatch = content.match(/\*\*Outcome\*\*:\s*([\s\S]*?)(?=\n\*\*|\n*$)/);

	if (!specMatch) return null;

	return {
		specName: specMatch[1].trim(),
		itemId: itemMatch ? itemMatch[1].trim() : "",
		outcome: outcomeMatch ? outcomeMatch[1].trim() : "",
	};
}
