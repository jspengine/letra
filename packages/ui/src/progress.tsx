import { cn } from "./utils";

type State = "default" | "active" | "warning" | "error" | "complete" | "agent";

interface ProgressProps {
	value: number;
	max?: number;
	label?: string;
	size?: "xs" | "sm" | "md";
	state?: State;
	barColor?: string;
	showValue?: boolean;
	indeterminate?: boolean;
	className?: string;
}

const stateStyles: Record<State, string> = {
	default: "var(--color-primary)",
	active: "var(--color-primary)",
	warning: "var(--color-warning)",
	error: "var(--color-danger)",
	complete: "var(--color-success)",
	agent: "var(--color-agent)",
};

export function Progress({
	value,
	max = 100,
	label,
	size = "md",
	state = "default",
	barColor,
	showValue,
	indeterminate = false,
	className,
}: ProgressProps) {
	const pct = Math.min(Math.max((value / max) * 100, 0), 100);
	const hMap = { xs: "h-1", sm: "h-1.5", md: "h-2" };
	const barClass = hMap[size];
	const fill = barColor ?? stateStyles[state];

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
							{Math.round(pct)}%
						</span>
					)}
				</div>
			)}
			<div
				className={cn("w-full rounded-full overflow-hidden", barClass)}
				style={{ background: "var(--color-bg-sunken)" }}
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={max}
				aria-valuenow={indeterminate ? undefined : value}
				aria-label={label}
			>
				<div
					className={cn(
						"rounded-full transition-all duration-300",
						barClass,
						indeterminate && "animate-progress-stripes",
					)}
					style={{
						width: indeterminate ? "100%" : `${pct}%`,
						background: state === "complete" && pct > 0 ? "var(--color-success)" : fill,
						color: "var(--color-text-primary)",
					}}
				/>
			</div>
		</div>
	);
}
