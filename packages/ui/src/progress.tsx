import { cn } from "./utils";

interface ProgressProps {
	value: number;
	max?: number;
	label?: string;
	size?: "xs" | "sm" | "md";
	barColor?: string;
	showValue?: boolean;
	className?: string;
}

export function Progress({
	value,
	max = 100,
	label,
	size = "md",
	barColor,
	showValue,
	className,
}: ProgressProps) {
	const pct = Math.min(Math.max((value / max) * 100, 0), 100);
	const hMap = { xs: "h-1", sm: "h-1.5", md: "h-2" };
	const barClass = hMap[size];

	return (
		<div className={cn("flex flex-col gap-1", className)}>
			{(label || showValue) && (
				<div className="flex items-center justify-between">
					{label && (
						<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
							{label}
						</span>
					)}
					{showValue && (
						<span
							className="text-xs tabular-nums"
							style={{ color: "var(--muted-foreground)" }}
						>
							{value}/{max}
						</span>
					)}
				</div>
			)}
			<div
				className={cn("w-full rounded-full overflow-hidden", barClass)}
				style={{ background: "var(--muted)" }}
			>
				<div
					className={cn("rounded-full transition-all duration-300", barClass)}
					style={{
						width: `${pct}%`,
						background: barColor ?? (pct >= 100 ? "var(--success)" : "var(--primary)"),
					}}
				/>
			</div>
		</div>
	);
}
