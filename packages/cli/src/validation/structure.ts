import { existsSync, readFileSync } from "node:fs";

export const REQUIRED_SECTIONS = [
	"## Outcome",
	"## Constraints",
	"## Exclusions",
	"## Acceptance Criteria",
	"## Context",
];

export interface StructureResult {
	errors: string[];
	warnings: string[];
}

export function checkRequiredSections(content: string): string[] {
	return REQUIRED_SECTIONS.filter((section) => !content.includes(section));
}

export function checkSpecLength(content: string, maxChars = 3000): string | null {
	return content.length > maxChars
		? `Spec exceeds ${maxChars} chars (should be thin — max 1 page)`
		: null;
}

export function checkChecklist(content: string): string | null {
	const hasChecklist = /-\s*\[[ x]\]\s*\*\*/i.test(content);
	if (!hasChecklist && content.includes("## Acceptance Criteria")) {
		return "Acceptance Criteria section exists but has no checklist items";
	}
	return null;
}

export function validateSpecStructure(specFile: string): StructureResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (!existsSync(specFile)) {
		errors.push("Missing spec.md");
		return { errors, warnings };
	}

	const content = readFileSync(specFile, "utf-8");

	const missingSections = checkRequiredSections(content);
	errors.push(...missingSections.map((s) => `Missing section: ${s}`));

	const lengthWarning = checkSpecLength(content);
	if (lengthWarning) warnings.push(lengthWarning);

	const checklistError = checkChecklist(content);
	if (checklistError) errors.push(checklistError);

	return { errors, warnings };
}
