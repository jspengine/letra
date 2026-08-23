import type { ExecutionContext, ExecutionResult } from "../harness/types.js";

export interface AgenticExecutor {
	id: string;
	label: string;
	capabilities: string[];
	status: "online" | "offline";
	execute(context: ExecutionContext): Promise<ExecutionResult>;
}

export interface RichAgenticExecutor extends AgenticExecutor {
	onHandoff?(handoff: { itemId: string; from: string; to: string; summary: string; evidence: string[] }): Promise<void>;
	collectEvidences?(item: { id: string; spec?: string }): Promise<string[]>;
	getContext?(item: { id: string; stage: string }): Promise<Record<string, unknown>>;
	heartbeat?(): Promise<void>;
}

export class ExecutorRegistry {
	private readonly executors: Map<string, AgenticExecutor> = new Map();
	private readonly preferences: Map<string, string[]> = new Map();

	register(executor: AgenticExecutor): void {
		this.executors.set(executor.id, executor);
	}

	unregister(executorId: string): void {
		this.executors.delete(executorId);
	}

	get(executorId: string): AgenticExecutor | undefined {
		return this.executors.get(executorId);
	}

	getAll(): AgenticExecutor[] {
		return Array.from(this.executors.values());
	}

	getByCapability(capability: string): AgenticExecutor[] {
		return this.getAll().filter((e) => e.capabilities.includes(capability));
	}

	getOnline(): AgenticExecutor[] {
		return this.getAll().filter((e) => e.status === "online");
	}

	setStagePreference(stageId: string, executorIds: string[]): void {
		this.preferences.set(stageId, executorIds);
	}

	getStagePreference(stageId: string): string[] {
		return this.preferences.get(stageId) || [];
	}

	selectForStage(stageId: string, capability: string): AgenticExecutor | null {
		const preferred = this.getStagePreference(stageId);
		for (const id of preferred) {
			const executor = this.get(id);
			if (executor && executor.status === "online" && executor.capabilities.includes(capability)) {
				return executor;
			}
		}

		const capable = this.getByCapability(capability).filter((e) => e.status === "online");
		if (capable.length === 0) return null;

		capable.sort((a, b) => {
			const aIdx = preferred.indexOf(a.id);
			const bIdx = preferred.indexOf(b.id);
			if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
			if (aIdx !== -1) return -1;
			if (bIdx !== -1) return 1;
			return 0;
		});

		return capable[0];
	}
}
