export type AdapterSource = "init" | "flow-move" | "focus" | "flow-ac";

export interface HarnessItem {
	id: string;
	description: string;
	spec?: string;
	claimedBy?: string;
	claimedAt?: string;
}

export interface HandoffStep {
	command: string;
	label: string;
	recovery?: string;
}

export interface HandoffData {
	steps: HandoffStep[];
	primaryItemId: string;
	nextStageName?: string;
	disabled?: boolean;
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
	} | null;
	alerts?: Array<{ id: string; severity: string; title: string; source: string; detectedAt: string }>;
	currentPhase?: {
		id: string;
		label: string;
		description: string;
		harness?: {
			instructions?: string;
			checks?: string[];
		};
	};
	handoff?: HandoffData;
}

export interface HandoffWorkflowConfig {
	enabled?: boolean;
	customSteps?: HandoffStep[];
	skipSteps?: string[];
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
			currentPhase?: string;
		}>;
		handoff?: HandoffWorkflowConfig | boolean;
	};
	activeStageId?: string;
	primaryItemId?: string;
	graveIssueCount?: number;
	workspaceDir?: string;
}

export type AdapterFormat = "at" | "text";

export interface AdapterTarget {
	tool: string;
	path: string;
	format: AdapterFormat;
	displayName: string;
}
