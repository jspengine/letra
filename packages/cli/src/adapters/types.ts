export type AdapterSource = "init" | "flow-move" | "focus";

export interface HarnessItem {
	id: string;
	description: string;
	spec?: string;
	specPath?: string;
	acceptancePath?: string;
	acPending?: number;
	acTotal?: number;
	tasksOpen?: number;
	tasksTotal?: number;
}

export interface HarnessSnapshot {
	workflowName: string;
	hasWorkflow: boolean;
	activeStage?: { id: string; name: string };
	items: HarnessItem[];
	hasFocus: boolean;
	primaryItemId: string | null;
	focusSpec: string | null;
	focusPath: string | null;
	acDrifts?: Array<{ spec: string; specCount: number; acceptanceCount: number }>;
}

export interface GenerateOptions {
	source: AdapterSource;
	workflow?: {
		name: string;
		stages: Array<{ id: string; name: string }>;
		items: Array<{
			id: string;
			description: string;
			stage: string;
			spec?: string;
			tasks?: Array<{ id: string; description: string; done: boolean }>;
		}>;
	};
	activeStageId?: string;
	primaryItemId?: string;
}

export type AdapterFormat = "at" | "text";

export interface AdapterTarget {
	tool: string;
	path: string;
	format: AdapterFormat;
	displayName: string;
}
