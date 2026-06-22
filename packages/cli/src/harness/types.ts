export interface AgentCapability {
	id: string;
	label: string;
	description: string;
	allowedStages: string[];
	capabilities: string[];
}

export interface Gate {
	id: string;
	name: string;
	type: "human" | "automated" | "external";
	blocking: boolean;
	policyRef?: string;
	description: string;
}

export interface StageDef {
	id: string;
	name: string;
	order: number;
	zone?: "todo" | "doing" | "done";
	description: string;
	agents: string[];
	gate: string | null;
}

export interface FlowTemplate {
	id: string;
	version: string;
	name: string;
	description: string;
	defaultPolicy: string;
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

export interface HarnessManifest {
	version: string;
	flows: Record<string, FlowTemplate>;
	gates: Record<string, Gate>;
	roles: Record<string, AgentCapability>;
	policies: Record<string, Policy>;
}
