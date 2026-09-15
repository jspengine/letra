/**
 * Declarative Flow Engine — Type definitions.
 *
 * These types define the YAML schema for flows that the engine interprets.
 * The engine contains zero if-statements referencing stage/role/operation names.
 */

// ============================================================
// Operations — Who can do what
// ============================================================

export interface FlowOperation {
	/** Capability required to perform this operation (e.g., "security_scan"). */
	required_capability?: string;
	/** Whether the actor must hold the current claim. */
	requires_claim?: boolean;
	/** Actor prefix required (e.g., "human:", "system:"). */
	actor_prefix?: string;
	/** Specific actor IDs allowed (e.g., ["reviewer"]). */
	allowed_actors?: string[];
	/** Stage IDs where this operation is allowed. ["*"] = any stage. */
	allowed_in_stages?: string[];
}

// ============================================================
// Gates — Approval policies
// ============================================================

export type GateType = "human" | "automated";

export interface FlowGate {
	id: string;
	type: GateType;
	blocking: boolean;
	/** For automated gates: the command to run for validation. */
	check?: string;
	/** Available decisions. */
	decisions: string[];
}

// ============================================================
// Hooks — Automatic actions on stage enter/exit
// ============================================================

export interface FlowHook {
	/** The action identifier to execute (e.g., "security_review", "capture_baseline"). */
	action: string;
	/** Whether this runs automatically without handoff. */
	auto?: boolean;
	/** Whether the actor must hold the claim. */
	requires_claim?: boolean;
	/** Additional parameters for the action. */
	params?: Record<string, unknown>;
}

// ============================================================
// Auto-transitions — Automatic stage transitions
// ============================================================

export interface FlowAutoTransition {
	/** Condition expression to evaluate (e.g., "security_clear AND human_approved"). */
	when: string;
	/** Target stage ID. */
	target: string;
	/** Actor for the auto-transition. */
	actor?: string;
	/** Actions to execute during the transition. */
	actions?: FlowAction[];
	/** If set, triggers rework instead of clean transition. */
	rework_for?: string[];
}

// ============================================================
// Actions — Commands to execute
// ============================================================

export interface FlowAction {
	type: "command";
	/** The command template (e.g., "letra ac done <AC-ID>"). */
	cmd: string;
}

// ============================================================
// Rework — Rework configuration per stage
// ============================================================

export interface FlowRework {
	/** Stage ID to return to on rework. */
	target: string;
	/** Actor IDs allowed to trigger rework. */
	allowed_actors: string[];
	/** Whether rework creates new acceptance criteria. */
	create_ac?: boolean;
}

// ============================================================
// Phases — Sub-states within a stage
// ============================================================

export interface FlowPhaseState {
	id: string;
	label: string;
	description?: string;
	actions?: FlowAction[];
	transitions: FlowPhaseTransition[];
}

export interface FlowPhaseTransition {
	target: string;
	gate?: string;
}

export interface FlowPhases {
	initialState: string;
	states: Record<string, FlowPhaseState>;
}

// ============================================================
// Activity — What to tell the agent
// ============================================================

export interface FlowActivityCommand {
	command: string;
	label: string;
}

export interface FlowActivity {
	objective: string;
	mustRead?: Array<{ path: string; reason: string }>;
	commands?: FlowActivityCommand[];
	mustNotDo?: string[];
	nextActions?: Array<{ label: string; description: string }>;
}

// ============================================================
// Stage — Complete stage definition
// ============================================================

export interface FlowStage {
	id: string;
	name: string;
	order: number;
	zone: "todo" | "doing" | "done";
	description?: string;
	agents: string[];
	gate: string | null;
	preferredExecutor?: string;
	rework?: FlowRework;
	hooks?: {
		on_enter?: FlowHook[];
		on_exit?: FlowHook[];
	};
	auto_transitions?: FlowAutoTransition[];
	phases?: FlowPhases;
	activity?: Record<string, FlowActivity>;
}

// ============================================================
// Flow — Complete flow definition
// ============================================================

export interface FlowExecutor {
	command: string;
	model?: string;
	timeout_ms?: number;
}

export interface FlowDefinition {
	id: string;
	version: string;
	name: string;
	description?: string;
	defaultPolicy?: string;
	capability_families?: Record<string, string[]>;
	executors?: Record<string, FlowExecutor>;
	operations?: Record<string, FlowOperation>;
	gates?: FlowGate[];
	stages: FlowStage[];
}

// ============================================================
// Engine types — Runtime
// ============================================================

export interface FlowItem {
	id: string;
	stage: string;
	phase?: string;
	claimedBy?: string;
	claimExecutorId?: string;
	spec?: string;
	securityBaseline?: unknown;
	[key: string]: unknown;
}

export interface TransitionResult {
	ok: boolean;
	item?: FlowItem;
	error?: string;
	reasonCode?: string;
	details?: Record<string, unknown>;
}

export interface GateCheckResult {
	passed: boolean;
	reason?: string;
}
