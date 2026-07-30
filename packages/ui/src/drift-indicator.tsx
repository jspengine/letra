import { cn } from "./utils";
import type { ReactNode } from "react";

interface DriftIndicatorProps {
	message?: string;
	action?: ReactNode;
	onDismiss?: () => void;
	className?: string;
}

export function DriftIndicator({
	message = "Drift detectado entre spec e implementação",
	action,
	onDismiss,
	className,
}: DriftIndicatorProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] border-[length:var(--border-thin)] px-[var(--space-3)] py-[var(--space-2)] animate-drift-pulse",
				className,
			)}
			style={{
				background: "color-mix(in srgb, var(--color-warning) 12%, transparent)",
				borderColor: "color-mix(in srgb, var(--color-warning) 35%, transparent)",
			}}
			role="alert"
		>
			<span
				className="size-2 shrink-0 rounded-full"
				style={{ background: "var(--color-warning)" }}
				aria-hidden="true"
			/>
			<span className="flex-1 text-body-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
				{message}
			</span>
			{action && <div className="shrink-0">{action}</div>}
			{onDismiss && (
				<button
					type="button"
					onClick={onDismiss}
					className="shrink-0 rounded p-1 text-caption transition-colors hover:bg-[var(--color-bg-sunken)]/50"
					style={{ color: "var(--color-text-secondary)" }}
					aria-label="Descartar"
				>
					✕
				</button>
			)}
		</div>
	);
}
