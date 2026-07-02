import { Card, CardContent, Icon } from "@letra/ui";
import type { IconName } from "@letra/ui";

interface Metric {
	label: string;
	value: string | number;
	icon: IconName;
	subtext?: string;
	trend?: "up" | "down" | "neutral";
	color?: string;
}

interface Props {
	metrics: Metric[];
}

function MetricCard({ metric }: { metric: Metric }) {
	const dotColor = metric.color ?? (
		metric.trend === "up" ? "var(--success)"
		: metric.trend === "down" ? "var(--error)"
		: "var(--muted-foreground)"
	);
	return (
		<Card className="p-4 transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5">
			<CardContent className="p-0 flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
						<Icon name={metric.icon} size={14} />
						{metric.label}
					</span>
					<div className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
				</div>
				<span className="text-2xl font-bold">{metric.value}</span>
				{metric.subtext && (
					<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
						{metric.subtext}
					</span>
				)}
			</CardContent>
		</Card>
	);
}

export default function MetricCards({ metrics }: Props) {
	return (
		<div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
			{metrics.map((m) => (
				<MetricCard key={m.label} metric={m} />
			))}
		</div>
	);
}
