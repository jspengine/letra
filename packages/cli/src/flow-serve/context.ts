import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildActivityContext } from "../activity-context/index.js";

export function resolveRequestedActivity(
	value: string | null,
): "design" | "implement" | "review" | "diagnose" | "gate" {
	return value === "design" ||
		value === "implement" ||
		value === "review" ||
		value === "diagnose" ||
		value === "gate"
		? value
		: "implement";
}

export function buildRequestedActivityContext(workspaceRoot: string, activityParam: string | null) {
	return buildActivityContext({
		activity: resolveRequestedActivity(activityParam),
		workspaceRoot,
	});
}

export function readFocusState(workspaceDir: string): {
	active: boolean;
	spec?: string;
	itemId?: string;
} {
	const focusFile = join(workspaceDir, "focus.md");
	if (!existsSync(focusFile)) return { active: false };
	const lines = readFileSync(focusFile, "utf-8").split(/\r?\n/);
	const itemLine = lines.find((line) => line.startsWith("**Item**: "));
	return {
		active: true,
		spec: lines[0]?.replace(/^#\s*/, "") || "",
		itemId: itemLine?.replace("**Item**: ", "") || undefined,
	};
}

export function readFocusDocument(workspaceDir: string): string | null {
	const focusFile = join(workspaceDir, "focus.md");
	return existsSync(focusFile) ? readFileSync(focusFile, "utf-8") : null;
}

export function readDecisions(workspaceDir: string): Array<{ name: string; content: string }> {
	const decisionsDir = join(workspaceDir, "decisions");
	if (!existsSync(decisionsDir)) return [];
	return readdirSync(decisionsDir)
		.filter((name) => name.endsWith(".md"))
		.sort()
		.reverse()
		.map((name) => ({
			name,
			content: readFileSync(join(decisionsDir, name), "utf-8"),
		}));
}

export function contextFileExists(workspaceDir: string, file: string): boolean {
	return existsSync(join(workspaceDir, file));
}
