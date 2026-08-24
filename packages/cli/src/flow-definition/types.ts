import type { ResolvedFlowDefinition } from "@letra/types";
import type { FlowTemplate, HarnessManifest } from "../harness/types.js";
import type { Workflow } from "../commands/flow-init.js";

export type {
	FlowDefinitionWarning,
	FlowDefinitionWarningCode,
	ResolvedFlowDefinition,
	ResolvedFlowGate,
	ResolvedFlowPhase,
	ResolvedFlowPhaseTransition,
	ResolvedFlowRole,
	ResolvedFlowStage,
	ResolvedStagePhases,
} from "@letra/types";

export interface ActiveFlowResolution {
	workflow: Workflow | null;
	harness: HarnessManifest | null;
	template: FlowTemplate | null;
	flow: ResolvedFlowDefinition | null;
}
