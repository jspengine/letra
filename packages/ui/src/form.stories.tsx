import "./index.css";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { DateField } from "./date-field";
import { DateRangeField } from "./date-range-field";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	Form,
	FormActions,
} from "./form";
import { Input } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Textarea } from "./textarea";
import { TimeField } from "./time-field";

export const Basic = () => (
	<Form className="w-full max-w-[520px]">
		<FieldGroup>
			<Field>
				<FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
				<Input id="workspace-name" defaultValue="Letra" />
				<FieldDescription>Name shown in supervision surfaces.</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor="release-note">Release note</FieldLabel>
				<Textarea
					id="release-note"
					defaultValue="Confirm DS readiness before promoting the release."
					rows={3}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor="review-policy">Review policy</FieldLabel>
				<Select defaultValue="human">
					<SelectTrigger id="review-policy">
						<SelectValue>Human approval</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="human">Human approval</SelectItem>
						<SelectItem value="automated">Automated checks</SelectItem>
					</SelectContent>
				</Select>
			</Field>
			<Checkbox label="Require evidence before closing gates" defaultChecked />
		</FieldGroup>
		<FormActions>
			<Button variant="secondary" type="button">
				Cancel
			</Button>
			<Button type="submit">Save</Button>
		</FormActions>
	</Form>
);

export const Validation = () => (
	<Form className="w-full max-w-[520px]">
		<FieldGroup>
			<Field invalid>
				<FieldLabel htmlFor="spec-id">Spec ID</FieldLabel>
				<Input
					id="spec-id"
					defaultValue="release readiness"
					aria-invalid
					aria-describedby="spec-id-error"
				/>
				<FieldError id="spec-id-error">
					Use a slug value, for example ux-release-readiness.
				</FieldError>
			</Field>
			<DateField label="Decision date" defaultValue="2026-07-15" />
			<TimeField label="Review time" defaultValue="14:00" />
			<DateRangeField
				label="Evidence window"
				description="Both dates are required for release review."
				error="End date must be after start date."
				startProps={{ defaultValue: "2026-07-20" }}
				endProps={{ defaultValue: "2026-07-15" }}
			/>
		</FieldGroup>
		<FormActions>
			<Button variant="secondary" type="button">
				Back
			</Button>
			<Button type="submit">Validate</Button>
		</FormActions>
	</Form>
);

export default {
	title: "Components/Form",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Composable form layout primitives with DS validation states. Use FieldGroup, Field, FieldLabel, FieldDescription and FieldError for consistent spacing and accessibility.",
			},
		},
		"x-ds": {
			category: "form",
			status: "ready",
			tokens: [
				"color-text-primary",
				"color-text-secondary",
				"color-danger",
				"space-4",
				"space-5",
			],
			consumes: [
				"Button",
				"Checkbox",
				"DateField",
				"DateRangeField",
				"Input",
				"Select",
				"Textarea",
				"TimeField",
			],
			surfaces: ["WorkspaceView", "SpecsView", "ContextView"],
			a11y: ["label", "aria-invalid", "aria-describedby", "role-alert"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
