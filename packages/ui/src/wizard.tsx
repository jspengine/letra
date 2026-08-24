import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "./icon";
import { cn } from "./utils";

type WizardStepStatus = "complete" | "current" | "upcoming" | "error";

function Wizard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="wizard"
			className={cn("flex flex-col gap-[var(--space-5)]", className)}
			{...props}
		/>
	);
}

function WizardSteps({ className, ...props }: HTMLAttributes<HTMLOListElement>) {
	return (
		<ol
			data-slot="wizard-steps"
			className={cn(
				"grid gap-[var(--space-3)] md:grid-cols-[repeat(auto-fit,minmax(0,1fr))]",
				className,
			)}
			{...props}
		/>
	);
}

function WizardStep({
	className,
	status = "upcoming",
	step,
	title,
	description,
	...props
}: HTMLAttributes<HTMLLIElement> & {
	status?: WizardStepStatus;
	step: number | string;
	title: ReactNode;
	description?: ReactNode;
}) {
	const isCurrent = status === "current";
	const isComplete = status === "complete";
	const isError = status === "error";

	return (
		<li
			data-slot="wizard-step"
			data-status={status}
			aria-current={isCurrent ? "step" : undefined}
			className={cn(
				"flex min-w-0 gap-[var(--space-3)] rounded-[var(--radius-lg)] border-[length:var(--border-thin)] border-[var(--color-border)] bg-[var(--color-bg-surface)] p-[var(--space-3)]",
				isCurrent &&
					"border-[var(--color-primary)] bg-[color-mix(in_oklch,var(--color-primary)_10%,var(--color-bg-surface))]",
				isError && "border-[var(--color-danger)]",
				className,
			)}
			{...props}
		>
			<span
				className={cn(
					"flex size-7 shrink-0 items-center justify-center rounded-full border-[length:var(--border-thin)] border-[var(--color-border)] bg-[var(--color-bg-base)] text-xs font-semibold text-[var(--color-text-secondary)]",
					(isCurrent || isComplete) &&
						"border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-accent)]",
					isError &&
						"border-[var(--color-danger)] bg-[var(--color-danger)] text-[var(--color-on-accent)]",
				)}
			>
				{isComplete ? <Icon name="check" size={14} /> : step}
			</span>
			<span className="flex min-w-0 flex-col gap-[var(--space-1)]">
				<span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
					{title}
				</span>
				{description ? (
					<span className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
						{description}
					</span>
				) : null}
			</span>
		</li>
	);
}

function WizardPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="wizard-panel"
			className={cn(
				"rounded-[var(--radius-lg)] border-[length:var(--border-thin)] border-[var(--color-border)] bg-[var(--color-bg-surface)] p-[var(--space-4)]",
				className,
			)}
			{...props}
		/>
	);
}

function WizardActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="wizard-actions"
			className={cn(
				"flex flex-wrap items-center justify-between gap-[var(--space-2)]",
				className,
			)}
			{...props}
		/>
	);
}

export { Wizard, WizardSteps, WizardStep, WizardPanel, WizardActions };
