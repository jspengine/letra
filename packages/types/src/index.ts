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

export type AdapterLiveContextMode = "none" | "cli" | "mcp";
export type AdapterRefreshMode = "session-start" | "on-demand";
export type AdapterArtifactFormat = "at" | "text" | "toml" | "skill";
export type AdapterArtifactKind = "instructions" | "config" | "skill";

export interface AdapterCapabilityProfile {
	instructions: boolean;
	nestedInstructions: boolean;
	skills: boolean;
	mcp: boolean;
	hooks: boolean;
	liveContext: AdapterLiveContextMode;
	refreshMode: AdapterRefreshMode;
}

export interface AdapterArtifactContract {
	id: string;
	path: string;
	format: AdapterArtifactFormat;
	kind: AdapterArtifactKind;
	consumers: readonly string[];
	ownership: "letra-owned" | "managed-section";
}

export interface AdapterContract {
	id: string;
	displayName: string;
	capabilities: AdapterCapabilityProfile;
	artifactIds: readonly string[];
	detectionPaths: readonly string[];
	fallbackTransport: "cli-json";
}

export interface AgentDirectionWarning {
	code: string;
	message: string;
}

export interface AgentDirectionCommand {
	id: string;
	command: string;
	label: string;
	mutates: boolean;
}

export interface AgentDirectionAction {
	id: string;
	label: string;
	reason: string;
}

export interface AgentDirectionSnapshot {
	schemaVersion: "1";
	revision: string;
	generatedAt: string;
	source: {
		harnessVersion: string | null;
		flowId: string | null;
		workspaceRoot: string;
	};
	mode: "active" | "degraded" | "unconfigured";
	item: {
		id: string;
		description: string;
		stage: string;
		spec: string | null;
	} | null;
	roleIds: string[];
	allowedStageIds: string[];
	objective: string | null;
	pendingAC: {
		id: string;
		description: string;
	} | null;
	commands: AgentDirectionCommand[];
	prohibitions: string[];
	requiredEvidence: string[];
	nextActions: AgentDirectionAction[];
	warnings: AgentDirectionWarning[];
}

export interface ResolvedSpec {
	id: string;
	content: string;
}

export type GateDecision = "approve" | "request-changes" | "reject";

export interface ResolvedFlowGate {
	id: string;
	name: string;
	type: "human" | "automated" | "external";
	blocking: boolean;
	policyRef?: string;
	description: string;
	decisions?: Partial<Record<GateDecision, string>>;
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

export interface FlowActivityCommandHint {
	command: string;
	label: string;
	description?: string;
}

export interface FlowActivityHint {
	objective?: string;
	mustRead?: FlowActivityReferenceHint[];
	mustNotDo?: string[];
	nextActions?: FlowActivityActionHint[];
	commands?: FlowActivityCommandHint[];
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
