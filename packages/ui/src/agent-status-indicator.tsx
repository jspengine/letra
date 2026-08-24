import type { HTMLAttributes } from "react";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

export type AgentState = "idle" | "thinking" | "running" | "error" | "done";

interface AgentStatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
	state?: AgentState;
	showLabel?: boolean;
}

const stateConfig: Record<
	AgentState,
	{ color: string; label: string; animate: string; glow: boolean }
> = {
	idle: {
		color: "var(--color-text-disabled)",
		label: "Ocioso",
		animate: "animate-agent-breathe",
		glow: false,
	},
	thinking: {
		color: "var(--color-agent)",
		label: "Raciocinando",
		animate: "animate-agent-breathe",
		glow: true,
	},
	running: {
		color: "var(--color-agent)",
		label: "Em execução",
		animate: "animate-agent-running",
		glow: true,
	},
	error: { color: "var(--color-danger)", label: "Erro", animate: "", glow: false },
	done: { color: "var(--color-success)", label: "Concluído", animate: "", glow: false },
};

export function AgentStatusIndicator({
	state = "idle",
	showLabel = false,
	className,
	...props
}: AgentStatusIndicatorProps) {
	const cfg = stateConfig[state];

	const dot = (
		<span
			className={cn("inline-block size-2.5 shrink-0 rounded-full", cfg.animate)}
			style={{
				background: cfg.color,
				boxShadow: cfg.glow ? `0 0 8px ${cfg.color}` : "none",
			}}
			aria-hidden="true"
		/>
	);

	if (showLabel) {
		return (
			<span
				className={cn("inline-flex items-center gap-[var(--space-1)]", className)}
				style={{ color: cfg.color }}
				aria-label={cfg.label}
				{...props}
			>
				{dot}
				<span className="text-caption font-medium">{cfg.label}</span>
			</span>
		);
	}

	return (
		<Tooltip content={cfg.label}>
			<span className={cn("inline-flex", className)} aria-label={cfg.label} {...props}>
				{dot}
			</span>
		</Tooltip>
	);
}
