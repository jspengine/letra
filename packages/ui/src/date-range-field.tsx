import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "./form";
import { Input } from "./input";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id" | "aria-invalid" | "aria-describedby">;

interface DateRangeFieldProps {
	label: string;
	description?: string;
	error?: string;
	startLabel?: string;
	endLabel?: string;
	startProps?: DateInputProps;
	endProps?: DateInputProps;
	required?: boolean;
	disabled?: boolean;
}

export function DateRangeField({
	label,
	description,
	error,
	startLabel = "Start date",
	endLabel = "End date",
	startProps,
	endProps,
	required,
	disabled,
}: DateRangeFieldProps) {
	const generatedId = useId();
	const startId = `${generatedId}-start`;
	const endId = `${generatedId}-end`;
	const descriptionId = description ? `${generatedId}-description` : undefined;
	const errorId = error ? `${generatedId}-error` : undefined;
	const invalid = Boolean(error);
	const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

	return (
		<Field invalid={invalid} disabled={disabled}>
			<FieldLabel>
				{label}
				{required ? <span aria-hidden="true">*</span> : null}
			</FieldLabel>
			<div data-slot="date-range-field" className="grid gap-[var(--space-3)] sm:grid-cols-2">
				<label className="flex min-w-0 flex-col gap-[var(--space-2)] text-xs font-medium text-[var(--color-text-secondary)]" htmlFor={startId}>
					{startLabel}
					<Input
						id={startId}
						type="date"
						required={required}
						disabled={disabled}
						aria-invalid={invalid}
						aria-describedby={describedBy}
						{...startProps}
					/>
				</label>
				<label className="flex min-w-0 flex-col gap-[var(--space-2)] text-xs font-medium text-[var(--color-text-secondary)]" htmlFor={endId}>
					{endLabel}
					<Input
						id={endId}
						type="date"
						required={required}
						disabled={disabled}
						aria-invalid={invalid}
						aria-describedby={describedBy}
						{...endProps}
					/>
				</label>
			</div>
			{description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
			<FieldError id={errorId}>{error}</FieldError>
		</Field>
	);
}
