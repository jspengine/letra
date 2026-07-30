import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "./form";
import { Input } from "./input";

interface TimeFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
	label: string;
	description?: string;
	error?: string;
}

export function TimeField({ label, description, error, id, required, disabled, ...props }: TimeFieldProps) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const descriptionId = description ? `${inputId}-description` : undefined;
	const errorId = error ? `${inputId}-error` : undefined;

	return (
		<Field invalid={Boolean(error)} disabled={disabled}>
			<FieldLabel htmlFor={inputId}>
				{label}
				{required ? <span aria-hidden="true">*</span> : null}
			</FieldLabel>
			<Input
				id={inputId}
				type="time"
				required={required}
				disabled={disabled}
				aria-invalid={Boolean(error)}
				aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
				{...props}
			/>
			{description ? <FieldDescription id={descriptionId}>{description}</FieldDescription> : null}
			<FieldError id={errorId}>{error}</FieldError>
		</Field>
	);
}
