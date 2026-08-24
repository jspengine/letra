import "./index.css";
import { useState } from "react";
import { Button } from "./button";
import { ConfirmDialog, Dialog, PromptDialog } from "./dialog";

export const Generic = () => {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button onClick={() => setOpen(true)}>Open dialog</Button>
			<Dialog open={open} onClose={() => setOpen(false)} title="Execution evidence">
				<p className="m-0 text-body-sm text-[var(--color-text-secondary)]">
					Pipeline onboarding executed successfully and is waiting for approval.
				</p>
			</Dialog>
		</>
	);
};

export const Confirm = () => {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button onClick={() => setOpen(true)}>Confirm</Button>
			<ConfirmDialog
				open={open}
				onClose={() => setOpen(false)}
				onConfirm={() => undefined}
				title="Stop agent?"
				message="This action stops agent-triage-01 immediately."
				variant="danger"
			/>
		</>
	);
};

export const Prompt = () => {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button onClick={() => setOpen(true)}>Prompt</Button>
			<PromptDialog
				open={open}
				onClose={() => setOpen(false)}
				onSubmit={() => undefined}
				title="Create agent"
				label="Agent name"
				placeholder="Ex: agent-triage-02"
			/>
		</>
	);
};

export default {
	title: "Components/Dialog",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Blocking overlay primitive for confirmation, prompts, and focused evidence review. Dialogs require a title, keyboard dismissal, and clear primary/secondary actions.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["overlay", "color-bg-surface", "color-border", "motion-slow"],
			consumes: ["Button", "Input", "Label", "Icon"],
			surfaces: ["FlowView", "ExecutionView", "SpecsView"],
			a11y: ["esc-close", "overlay-dismiss", "dialog-label"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
