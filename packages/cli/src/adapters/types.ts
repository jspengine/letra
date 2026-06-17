export type AdapterSource = "init" | "flow-move" | "focus";

export interface HarnessItem {
	id: string;
	description: string;
	spec?: string;
	claimedBy?: string;
	claimedAt?: string;
}

export interface HarnessSnapshot {
	workflowName: string;
	hasWorkflow: boolean;
	activeStage?: { id: string; name: string };
	nextStage?: { id: string; name: string };
	items: HarnessItem[];
	hasFocus: boolean;
	primaryItemId: string | null;
	focusSpec: string | null;
	focusPath: string | null;
	pendingACs: number;
	totalACs: number;
	lastSession?: {
		lastDate: string;
		actionsSummary: string;
	};
	alerts?: Array<{ id: string; severity: string; title: string; source: string; detectedAt: string }>;
}

export interface GenerateOptions {
	source: AdapterSource;
	workflow?: {
		name: string;
		stages: Array<{ id: string; name: string; order?: number; zone?: string }>;
		items: Array<{
			id: string;
			description: string;
			stage: string;
			spec?: string;
			tasks?: Array<{ id: string; description: string; done: boolean }>;
			claimedBy?: string;
			claimedAt?: string;
		}>;
	};
	activeStageId?: string;
	primaryItemId?: string;
	graveIssueCount?: number;
}

export type AdapterFormat = "at" | "text";

export interface AdapterTarget {
	tool: string;
	path: string;
	format: AdapterFormat;
	displayName: string;
}
