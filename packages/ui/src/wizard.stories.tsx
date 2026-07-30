import "./index.css";
import { Button } from "./button";
import { DateRangeField } from "./date-range-field";
import { Field, FieldDescription, FieldGroup, FieldLabel, Form } from "./form";
import { Input } from "./input";
import { Wizard, WizardActions, WizardPanel, WizardStep, WizardSteps } from "./wizard";

export const ReviewFlow = () => (
	<Wizard className="w-full max-w-[760px]">
		<WizardSteps>
			<WizardStep step={1} status="complete" title="Scope" description="Release surfaces selected" />
			<WizardStep step={2} status="current" title="Evidence" description="Collect validation window" />
			<WizardStep step={3} status="upcoming" title="Decision" description="Human approval required" />
		</WizardSteps>
		<WizardPanel>
			<Form>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="evidence-owner">Evidence owner</FieldLabel>
						<Input id="evidence-owner" defaultValue="Release reviewer" />
						<FieldDescription>Person accountable for the final review packet.</FieldDescription>
					</Field>
					<DateRangeField
						label="Evidence window"
						startProps={{ defaultValue: "2026-07-14" }}
						endProps={{ defaultValue: "2026-07-15" }}
					/>
				</FieldGroup>
			</Form>
		</WizardPanel>
		<WizardActions>
			<Button variant="secondary" type="button">Back</Button>
			<Button type="button">Continue</Button>
		</WizardActions>
	</Wizard>
);

export const WithError = () => (
	<Wizard className="w-full max-w-[760px]">
		<WizardSteps>
			<WizardStep step={1} status="complete" title="Scope" />
			<WizardStep step={2} status="error" title="Evidence" description="Window needs correction" />
			<WizardStep step={3} status="upcoming" title="Decision" />
		</WizardSteps>
		<WizardPanel>
			<DateRangeField
				label="Evidence window"
				error="End date must be after start date."
				startProps={{ defaultValue: "2026-07-20" }}
				endProps={{ defaultValue: "2026-07-15" }}
			/>
		</WizardPanel>
	</Wizard>
);

export default {
	title: "Components/Wizard",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Guided multi-step layout for bounded setup or review flows. Use it when the user must complete a small ordered sequence before making a decision.",
			},
		},
		"x-ds": {
			category: "pattern",
			status: "ready",
			tokens: ["color-border", "color-primary", "color-danger", "radius-lg", "space-5"],
			consumes: ["Button", "DateRangeField", "Form", "Icon", "Input"],
			surfaces: ["WorkspaceView", "SpecsView"],
			a11y: ["aria-current-step", "ordered-steps"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
