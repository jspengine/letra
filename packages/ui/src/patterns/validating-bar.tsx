import { cn } from "../utils";

interface ValidatingBarProps {
	className?: string;
	label?: string;
}

export function ValidatingBar({ className, label = "Validating..." }: ValidatingBarProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-[var(--space-3)] overflow-hidden rounded-[var(--radius-md)] border-[length:var(--border-thin)] bg-[var(--color-bg-surface)] px-[var(--space-3)] py-[var(--space-2)]",
				className,
			)}
			style={{ borderColor: "var(--color-border)" }}
			aria-live="polite"
		>
			<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-sunken)]">
				<div
					className="h-full w-1/3 rounded-full animate-validating-bar"
					style={{
						background:
							"linear-gradient(90deg, transparent, var(--color-primary), transparent)",
					}}
				/>
			</div>
			<span
				className="whitespace-nowrap text-caption font-medium"
				style={{ color: "var(--color-text-secondary)" }}
			>
				{label}
			</span>
		</div>
	);
}
