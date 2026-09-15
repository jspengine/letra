export interface AgentHandoffConfig {
	blocksHandoff: boolean;
	allowedTargets: string[];
	requireEvidence: boolean;
	ttlMinutes?: number;
}

export interface AgentCapability {
	id: string;
	label: string;
	description: string;
	allowedStages: string[];
	capabilities: string[];
	handoff?: AgentHandoffConfig;
	promptTemplate?: string;
}

export interface Gate {
	id: string;
	name: string;
	type: "human" | "automated" | "external";
	blocking: boolean;
	blocksHandoff?: boolean;
	policyRef?: string;
	description: string;
	decisions?: Partial<Record<"approve" | "request-changes" | "reject", string>>;
	/** Pre-check to run before the main gate check (e.g., "security-scoped" for human gates). */
	pre_check?: GateCheckType;
	/** Check type for automated gates (e.g., "validation", "security-scoped"). */
	check_type?: GateCheckType;
}

export type GateCheckType = "validation" | "security-scoped" | "spec-linked" | "acceptance-complete";

export interface FlowOperationDef {
	required_capability?: string;
	requires_claim?: boolean;
	allowed_in_stages?: string[];
	allowed_actors?: string[];
	actor_prefix?: string;
	description?: string;
}

export interface StageHookDef {
	action: string;
	auto?: boolean;
	requires_claim?: boolean;
	params?: Record<string, unknown>;
}

export type HarnessActivityKind = "design" | "implement" | "review" | "diagnose" | "gate";

export interface ActivityReferenceHint {
	path: string;
	reason: string;
}

export interface ActivityActionHint {
	label: string;
	description: string;
}

export interface ActivityCommandHint {
	command: string;
	label: string;
	description?: string;
}

export interface ActivityHintConfig {
	objective?: string;
	mustRead?: ActivityReferenceHint[];
	mustNotDo?: string[];
	nextActions?: ActivityActionHint[];
	commands?: ActivityCommandHint[];
}

export interface ReviewExpectationConfig extends ActivityHintConfig {
	label?: string;
	emphasis?: string;
	riskFocus?: string;
	evidencePrompt?: string;
	signalCode?: string;
}

export interface GateExpectationConfig extends ActivityHintConfig {
	label?: string;
	evidence?: string;
	decision?: string;
	signalCode?: string;
}

export interface StageActivityContextConfig {
	design?: ActivityHintConfig;
	implement?: ActivityHintConfig;
	review?: ReviewExpectationConfig;
	diagnose?: ActivityHintConfig;
	gate?: GateExpectationConfig;
}

export type PhaseId = string;

export interface PhaseTransition {
	target: PhaseId;
	gate?: string;
	auto?: boolean;
}

export type PhaseAction =
	| { type: "agent-prompt"; prompt: string }
	| { type: "command"; cmd: string }
	| { type: "generate-report"; template: string }
	| { type: "notify-human"; message: string }
	| { type: "wait-human"; gate: string };

export interface PhaseHarnessConfig {
	instructions?: string;
	tools?: string[];
	checks?: string[];
	activity?: StageActivityContextConfig;
	review?: ReviewExpectationConfig;
	gate?: GateExpectationConfig;
}

export interface PhaseDef {
	id: PhaseId;
	label: string;
	description: string;
	actions?: PhaseAction[];
	transitions?: PhaseTransition[];
	harness?: PhaseHarnessConfig;
}

export interface StagePhases {
	initialState: PhaseId;
	states: Record<PhaseId, PhaseDef>;
}

export interface StageDef {
	id: string;
	name: string;
	order: number;
	zone?: "todo" | "doing" | "done";
	description: string;
	agents: string[];
	gate: string | null;
	preferredExecutor?: string;
	phases?: StagePhases;
	activity?: StageActivityContextConfig;
	rework?: {
		target?: string;
		allowed_actors?: string[];
		create_ac?: boolean;
	};
	hooks?: {
		on_enter?: StageHookDef[];
		on_exit?: StageHookDef[];
	};
	auto_transitions?: Array<{
		from?: string;
		gate?: string;
		allow_claim?: boolean;
		condition?: string;
	}>;
}

export interface FlowTemplate {
	id: string;
	version: string;
	name: string;
	description: string;
	defaultPolicy: string;
	operations?: Record<string, FlowOperationDef>;
	stages: StageDef[];
}

export interface Policy {
	id: string;
	version: string;
	review: {
		minReviewers: number;
		requireHuman: boolean;
		allowAgentToComment: boolean;
		allowAgentToApprove: boolean;
	};
	security: {
		blockOnCritical: boolean;
		blockOnHigh: boolean;
		allowAgentToOverride: boolean;
	};
	pr: {
		requireDescription: boolean;
		requireChecksPassing: boolean;
		allowAgentToMerge: boolean;
	};
}

export interface ExecutorRegistryEntry {
	id: string;
	label: string;
	capabilities: string[];
	notification: ("sse" | "polling" | "file-watch")[];
	heartbeat: boolean;
	maxExecutionTime: number;
	priority: number;
}

export interface ExecutorRegistry {
	executors: ExecutorRegistryEntry[];
	stageExecutorPreferences: Record<string, string[]>;
}

export interface HarnessManifest {
	version: string;
	flows: Record<string, FlowTemplate>;
	gates: Record<string, Gate>;
	roles: Record<string, AgentCapability>;
	policies: Record<string, Policy>;
	constitutionVersion?: string;
	executors?: ExecutorRegistry;
}

// Orchestration Types

export interface HandoffPayload {
	itemId: string;
	from: string;
	to: string;
	summary: string;
	evidence: string[];
	context?: Record<string, unknown>;
	timestamp: string;
	expiresAt: string;
	executorId?: string;
}

export interface HandoffEvent {
	type: "handoff";
	itemId: string;
	from: string;
	to: string;
	summary: string;
	evidence: string[];
	timestamp: string;
}

export interface ExecutionContext {
	itemId: string;
	item: unknown;
	agent: string;
	stage: string;
	spec: string | null;
	diff: string | null;
	snapshot: unknown;
	sessionLog: unknown[];
	commands: string[];
	prohibitions: string[];
	promptTemplate?: string | null;
}

export interface ExecutionResult {
	success: boolean;
	output: string;
	artifacts: string[];
	evidences: string[];
	handoff?: HandoffEvent;
	error?: string;
}

export interface ExecutorConfig {
	id: string;
	label: string;
	capabilities: string[];
	notification: ("sse" | "polling" | "file-watch")[];
	heartbeat: boolean;
	maxExecutionTime: number;
	priority: number;
}

export interface HeartbeatInfo {
	executorId: string;
	lastHeartbeat: string;
	isOnline: boolean;
}
