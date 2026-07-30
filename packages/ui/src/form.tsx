import type { FormHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Label } from "./label";
import { cn } from "./utils";

function Form({ className, ...props }: FormHTMLAttributes<HTMLFormElement>) {
	return <form data-slot="form" className={cn("flex flex-col gap-[var(--space-5)]", className)} {...props} />;
}

function FieldGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div data-slot="field-group" className={cn("flex flex-col gap-[var(--space-4)]", className)} {...props} />;
}

function Field({
	className,
	invalid,
	disabled,
	...props
}: HTMLAttributes<HTMLDivElement> & { invalid?: boolean; disabled?: boolean }) {
	return (
		<div
			data-slot="field"
			data-invalid={invalid ? true : undefined}
			data-disabled={disabled ? true : undefined}
			className={cn("flex min-w-0 flex-col gap-[var(--space-2)]", className)}
			{...props}
		/>
	);
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
	return <Label data-slot="field-label" className={cn("text-[var(--color-text-primary)]", className)} {...props} />;
}

function FieldDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p
			data-slot="field-description"
			className={cn("text-xs leading-relaxed text-[var(--color-text-secondary)]", className)}
			{...props}
		/>
	);
}

function FieldError({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement> & { children?: ReactNode }) {
	if (!children) return null;
	return (
		<p
			data-slot="field-error"
			role="alert"
			className={cn("text-xs font-medium leading-relaxed text-[var(--color-danger)]", className)}
			{...props}
		>
			{children}
		</p>
	);
}

function FormActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="form-actions"
			className={cn("flex flex-wrap items-center justify-end gap-[var(--space-2)]", className)}
			{...props}
		/>
	);
}

export { Form, FieldGroup, Field, FieldLabel, FieldDescription, FieldError, FormActions };
