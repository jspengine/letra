import { cn } from "./utils";

interface ThroughputMeterProps {
	value: number;
	max?: number;
	baseline?: number;
	label?: string;
	showValue?: boolean;
	color?: string;
	className?: string;
}

export function ThroughputMeter({
	value,
	max = 100,
	baseline,
	label,
	showValue = false,
	color = "var(--color-primary)",
	className,
}: ThroughputMeterProps) {
	const pct = Math.min(Math.max((value / max) * 100, 0), 100);
	const baselinePct = baseline !== undefined ? Math.min(Math.max((baseline / max) * 100, 0), 100) : undefined;

	return (
		<div className={cn("flex flex-col gap-[var(--space-1)]", className)}>
			{(label || showValue) && (
				<div className="flex items-center justify-between">
					{label && (
						<span className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
							{label}
						</span>
					)}
					{showValue && (
						<span className="text-caption tabular-nums" style={{ color: "var(--color-text-secondary)" }}>
							{value}/{max}
						</span>
					)}
				</div>
			)}
			<div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ background: "var(--color-bg-sunken)" }}>
				<div
					className="h-full rounded-full transition-all duration-300"
					style={{ width: `${pct}%`, background: color }}
				/>
				{baselinePct !== undefined && (
					<div
						className="absolute top-0 bottom-0 w-0.5 rounded-full"
						style={{
							left: `${baselinePct}%`,
							background: "var(--color-text-disabled)",
							opacity: 0.6,
						}}
						aria-hidden="true"
					/>
				)}
			</div>
		</div>
	);
}
