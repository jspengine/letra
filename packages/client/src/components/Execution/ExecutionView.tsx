import type { Workflow } from "@letra/types";
import type { ActiveFlowDefinition } from "../../lib/active-flow";
import AgentDetail from "./AgentDetail";

interface ExecutionViewProps {
	workflow: Workflow;
	activeFlow: ActiveFlowDefinition | null;
	loading?: boolean;
}

export default function ExecutionView({ workflow, activeFlow, loading }: ExecutionViewProps) {
	return (
		<main className="flex flex-1 overflow-hidden">
			<AgentDetail workflow={workflow} activeFlow={activeFlow} loading={loading} />
		</main>
	);
}
