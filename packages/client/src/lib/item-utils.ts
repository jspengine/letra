import type { Item, ResolvedSpec, Workflow } from "@letra/types";

export function computeSlug(item: Item, specs: ResolvedSpec[], workflow: Workflow): string {
	if (item.spec) {
		const specLink = workflow.specLinks?.[item.spec];
		if (specLink) {
			const name = item.spec;
			return name
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^a-z0-9-]/g, "");
		}
	}
	const words = item.description.trim().split(/\s+/).filter(Boolean);
	const base =
		words
			.slice(0, 3)
			.join("-")
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "") || item.id.toLowerCase();
	const existing = new Set(
		workflow.items
			.filter((it) => it.id !== item.id)
			.map((it) => computeSlugRaw(it, specs, workflow)),
	);
	let slug = base;
	let n = 2;
	while (existing.has(slug)) {
		slug = `${base}-${n}`;
		n++;
	}
	return slug;
}

function computeSlugRaw(item: Item, specs: ResolvedSpec[], workflow: Workflow): string {
	if (item.spec) {
		const specLink = workflow.specLinks?.[item.spec];
		if (specLink)
			return item.spec
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^a-z0-9-]/g, "");
	}
	const words = item.description.trim().split(/\s+/).filter(Boolean);
	return (
		words
			.slice(0, 3)
			.join("-")
			.toLowerCase()
			.replace(/[^a-z0-9-]/g, "") || item.id.toLowerCase()
	);
}

export type ItemType = "FEAT" | "BUG" | "CHORE" | "DOCS" | "TEST";

export function computeTypeTag(item: Item): ItemType {
	const text = `${item.spec ?? ""} ${item.description}`.toLowerCase();
	if (/\b(fix|bug|hotfix)\b/.test(text)) return "BUG";
	if (/\b(doc|docs|spec)\b/.test(text)) return "DOCS";
	if (/\btest(s|e)?\b/.test(text)) return "TEST";
	if (/\b(chore|refactor|ci|build)\b/.test(text)) return "CHORE";
	return "FEAT";
}

export const TYPE_COLORS: Record<ItemType, string> = {
	FEAT: "var(--success)",
	BUG: "var(--error)",
	CHORE: "var(--info)",
	DOCS: "var(--warning)",
	TEST: "var(--color-info)",
};

export function countACs(specContent: string): { done: number; total: number } {
	const lines = specContent.split("\n");
	let done = 0;
	let total = 0;
	for (const line of lines) {
		const trimmed = line.trim();
		if (/^- \[ \]/.test(trimmed)) total++;
		if (/^- \[x\]/i.test(trimmed)) {
			done++;
			total++;
		}
	}
	return { done, total };
}

export function hasSpecOnDisk(specId: string, workflow: Workflow): boolean {
	return !!workflow.specLinks?.[specId];
}

export function resolveSpecName(specId: string, workflow: Workflow): string {
	return workflow.specLinks?.[specId] ? specId : specId;
}

export function stageName(item: Item, workflow: Workflow): string {
	return workflow.stages.find((s) => s.id === item.stage)?.name ?? item.stage;
}
