import { Badge } from "@letra/ui";

interface PhaseBadgeProps {
	phase: { id: string; label: string };
}

export function PhaseBadge({ phase }: PhaseBadgeProps) {
	return (
		<Badge variant="secondary" className="shrink-0">
			{phase.label}
		</Badge>
	);
}
