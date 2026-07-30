import { Alert, Badge } from "@letra/ui";
import { flowWarnings, type ActiveFlowDefinition } from "../../lib/active-flow";

interface Props {
	activeFlow: ActiveFlowDefinition | null;
}

export function FlowDefinitionWarnings({ activeFlow }: Props) {
	const warnings = flowWarnings(activeFlow);
	if (warnings.length === 0) return null;
	return (
		<div className="p-4">
			<Alert
				variant="warning"
				title={`Flow ativo com ${warnings.length} aviso${warnings.length === 1 ? "" : "s"}`}
			>
				<div className="grid grid-cols-1 gap-2 pt-1 lg:grid-cols-2">
					{warnings.map((warning, index) => (
						<div
							key={`${warning.code}-${warning.artifactRef ?? index}`}
							className="grid grid-cols-1 items-start gap-1.5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-2"
						>
							<Badge variant="info" className="w-fit max-w-full break-all text-caption">
								{warning.code}
							</Badge>
							<span>
								{warning.message}
								{warning.artifactRef ? ` (${warning.artifactRef})` : ""}
							</span>
						</div>
					))}
				</div>
			</Alert>
		</div>
	);
}
