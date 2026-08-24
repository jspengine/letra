import { Badge } from "@letra/ui";

interface PhaseBadgeProps {
	phase: { id: string; label: string };
}

export function PhaseBadge({ phase }: PhaseBadgeProps) {
	return (
		<Badge variant="info" className="shrink-0">
			{phase.label}
		</Badge>
	);
}
