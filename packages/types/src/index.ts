export interface Stage {
	id: string;
	name: string;
	order: number;
	zone?: "todo" | "doing" | "done";
	allow?: string[];
	validate?: string[];
	color?: string;
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
