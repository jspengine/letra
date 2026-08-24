import { cn } from "./utils";
import { Tooltip } from "./tooltip";

type DotColor = "primary" | "success" | "danger" | "warning" | "info" | "agent" | "disabled";

interface StatusDotProps {
	color?: DotColor;
	pulse?: boolean;
	label?: string;
	className?: string;
}

const dotColors: Record<DotColor, string> = {
	primary: "var(--color-primary)",
	success: "var(--color-success)",
	danger: "var(--color-danger)",
	warning: "var(--color-warning)",
	info: "var(--color-info)",
	agent: "var(--color-agent)",
	disabled: "var(--color-text-disabled)",
};

export function StatusDot({ color = "disabled", pulse = false, label, className }: StatusDotProps) {
	const bg = dotColors[color];
	const dot = (
		<span
			className={cn(
				"inline-block size-2 rounded-full shrink-0",
				pulse && "animate-pulse",
				className,
			)}
			style={{ background: bg }}
			aria-label={label}
		/>
	);

	if (label) {
		return <Tooltip content={label}>{dot}</Tooltip>;
	}
	return dot;
}
