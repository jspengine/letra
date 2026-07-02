export interface Stage {
	id: string;
	name: string;
	order: number;
	zone?: "todo" | "doing" | "done";
	allow?: string[];
	validate?: string[];
	color?: string;
	phases?: {
		initialState: string;
		states: Record<string, { id: string; label: string; description: string }>;
	};
}

export interface Task {
	id: string;
	description: string;
	done: boolean;
}

export interface Item {
	id: string;
	description: string;
	stage: string;
	createdAt: string;
	source?: "github" | "linear";
	sourceUrl?: string;
	spec?: string;
	tasks?: Task[];
	claimedBy?: string;
	claimedAt?: string;
	currentPhase?: string;
}

export interface SpecLink {
	path: string;
	aliases?: string[];
}

export interface WebhookConfig {
	id: string;
	url: string;
	events: string[];
	label?: string;
	lastStatus?: "ok" | "error";
	lastSentAt?: string;
}

export interface Workflow {
	version: string;
	name: string;
	description?: string;
	language?: string;
	template?: string;
	harnessVersion?: string;
	specLinks?: Record<string, SpecLink>;
	createdAt: string;
	updatedAt: string;
	stages: Stage[];
	items: Item[];
	tools: string[];
	webhooks?: WebhookConfig[];
	primaryItemId?: string;
}

export interface ResolvedSpec {
	id: string;
	content: string;
}

export interface ResolvedFlowGate {
	id: string;
	name: string;
	type: "human" | "automated" | "external";
	blocking: boolean;
	policyRef?: string;
	description: string;
}

export interface ResolvedFlowRole {
	id: string;
	label: string;
	description: string;
	allowedStages: string[];
	capabilities: string[];
}

export type FlowActivityKind = "design" | "implement" | "review" | "diagnose" | "gate";

export interface FlowActivityReferenceHint {
	path: string;
	reason: string;
}

export interface FlowActivityActionHint {
	label: string;
	description: string;
}

export interface FlowActivityHint {
	objective?: string;
	mustRead?: FlowActivityReferenceHint[];
	mustNotDo?: string[];
	nextActions?: FlowActivityActionHint[];
}

export interface FlowReviewExpectation extends FlowActivityHint {
	label?: string;
	emphasis?: string;
	riskFocus?: string;
	evidencePrompt?: string;
	signalCode?: string;
}

export interface FlowGateExpectation extends FlowActivityHint {
	label?: string;
	evidence?: string;
	decision?: string;
	signalCode?: string;
}

export interface ResolvedFlowActivity {
	design?: FlowActivityHint;
	implement?: FlowActivityHint;
	review?: FlowReviewExpectation;
	diagnose?: FlowActivityHint;
	gate?: FlowGateExpectation;
}

export type ResolvedFlowPhaseAction =
	| { type: "agent-prompt"; prompt: string }
	| { type: "command"; cmd: string }
	| { type: "generate-report"; template: string }
	| { type: "notify-human"; message: string }
	| { type: "wait-human"; gate: string };

export interface ResolvedFlowPhaseTransition {
	target: string;
	gate: ResolvedFlowGate | null;
	gateRef?: string;
	auto?: boolean;
}

export interface ResolvedFlowPhase {
	id: string;
	label: string;
	description: string;
	actions?: ResolvedFlowPhaseAction[];
	transitions?: ResolvedFlowPhaseTransition[];
	harness?: {
		instructions?: string;
		tools?: string[];
		checks?: string[];
		activity?: ResolvedFlowActivity;
		review?: FlowReviewExpectation;
		gate?: FlowGateExpectation;
	};
}

export interface ResolvedStagePhases {
	initialState: string;
	states: Record<string, ResolvedFlowPhase>;
}

export type FlowDefinitionWarningCode =
	| "HARNESS_UNAVAILABLE"
	| "TEMPLATE_NOT_FOUND"
	| "GATE_NOT_FOUND"
	| "ROLE_NOT_FOUND"
	| "INSTANCE_STAGE_NOT_IN_TEMPLATE"
	| "TEMPLATE_STAGE_NOT_IN_INSTANCE";

export interface FlowDefinitionWarning {
	code: FlowDefinitionWarningCode;
	message: string;
	artifactRef?: string;
}

export interface ResolvedFlowStage {
	id: string;
	name: string;
	order: number;
	zone?: "todo" | "doing" | "done";
	description?: string;
	roleIds: string[];
	roles: ResolvedFlowRole[];
	/** @deprecated Use roleIds and roles. */
	agents: string[];
	gate: ResolvedFlowGate | null;
	phases?: ResolvedStagePhases;
	activity?: ResolvedFlowActivity;
	provenance: "harness" | "workflow-instance";
}

export interface ResolvedFlowDefinition {
	id: string | null;
	source: "workflow-template" | "workflow-instance" | "legacy-fallback";
	harnessVersion: string | null;
	templateVersion: string | null;
	name: string;
	stages: ResolvedFlowStage[];
	roles: ResolvedFlowRole[];
	warnings: FlowDefinitionWarning[];
}
