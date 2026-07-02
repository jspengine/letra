export type ActivityKind = "design" | "implement" | "review" | "diagnose" | "gate";

export interface ActivityContextReference {
	path: string;
	reason: string;
}

export interface ActivityContextSignal {
	level: "info" | "warning" | "error";
	code: string;
	message: string;
}

export interface ActivityContextAction {
	label: string;
	description: string;
}

export interface ActivityContextRisk {
	level: "low" | "medium" | "high";
	message: string;
}

export interface ActivityContextCurrentItem {
	id: string;
	description: string;
	stage: string;
	stageName: string;
	currentPhase?: string;
	spec: string | null;
	outcome: string | null;
	acs: { pending: number; done: number; total: number };
}

export interface ActivityContext {
	activity: ActivityKind;
	objective: string;
	currentItem: ActivityContextCurrentItem | null;
	stage: { id: string; name: string } | null;
	mustRead: ActivityContextReference[];
	mustNotDo: string[];
	nextActions: ActivityContextAction[];
	risks: ActivityContextRisk[];
	signals: ActivityContextSignal[];
}

export interface BuildActivityContextOptions {
	activity: ActivityKind;
	workspaceRoot: string;
}
