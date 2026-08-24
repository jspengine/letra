import "./index.css";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardFooter, CardHeader } from "./card";
import { Icon } from "./icon";

export const Default = () => (
	<Card>
		<CardHeader>
			<div className="text-h3">Pipeline status</div>
			<div className="text-body-sm text-[var(--color-text-secondary)]">
				Current release validation
			</div>
		</CardHeader>
		<CardContent>
			<div className="flex flex-col gap-[var(--space-2)]">
				<span className="text-body-sm text-[var(--color-text-primary)]">
					Automatic checks passed and the release is waiting for human approval.
				</span>
				<span className="text-caption text-[var(--color-text-secondary)]">
					Updated 10 minutes ago.
				</span>
			</div>
		</CardContent>
		<CardFooter>
			<Badge variant="success">healthy</Badge>
		</CardFooter>
	</Card>
);

export const AgentActive = () => (
	<Card variant="agent">
		<CardHeader>
			<div className="flex items-center gap-[var(--space-3)]">
				<div className="flex size-[var(--icon-lg)] items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-sunken)]">
					<Icon name="bot" size={16} className="text-[var(--color-agent)]" />
				</div>
				<div className="flex flex-col">
					<span className="text-body-sm font-semibold">Agent runner</span>
					<span className="text-caption text-[var(--color-text-secondary)]">
						running on executor-1
					</span>
				</div>
			</div>
			<Badge variant="agent" className="w-fit">
				reasoning
			</Badge>
		</CardHeader>
		<CardContent>
			<div className="flex flex-col gap-[var(--space-2)] text-body-sm text-[var(--color-text-primary)]">
				<span>The agent is executing the active flow with a live heartbeat.</span>
				<span className="text-caption text-[var(--color-text-secondary)]">
					Started 10 minutes ago. Last heartbeat 2 seconds ago.
				</span>
			</div>
		</CardContent>
		<CardFooter>
			<div className="flex w-full items-center justify-between">
				<Badge variant="success">healthy</Badge>
				<div className="flex gap-[var(--space-2)]">
					<Button variant="secondary" size="sm">
						Logs
					</Button>
					<Button variant="danger" size="sm">
						Stop
					</Button>
				</div>
			</div>
		</CardFooter>
	</Card>
);

export const WithActions = () => (
	<Card>
		<CardHeader>
			<div className="text-h3">Configuration</div>
			<div className="text-body-sm text-[var(--color-text-secondary)]">
				Review before saving
			</div>
		</CardHeader>
		<CardContent>
			<div className="flex flex-col gap-[var(--space-2)] text-body-sm text-[var(--color-text-primary)]">
				<span>
					This card demonstrates header, body, and footer actions in a single composition.
				</span>
				<span className="text-caption text-[var(--color-text-secondary)]">
					Use the footer for one primary action and one secondary action.
				</span>
			</div>
		</CardContent>
		<CardFooter>
			<div className="flex w-full items-center justify-between">
				<Badge variant="amber">unsaved changes</Badge>
				<div className="flex gap-[var(--space-2)]">
					<Button variant="secondary" size="sm">
						Cancel
					</Button>
					<Button size="sm">Save</Button>
				</div>
			</div>
		</CardFooter>
	</Card>
);

export default {
	title: "Components/Card",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Surface primitive for grouped product content. Use it for repeated items, modals, and framed tools; avoid nesting cards and keep headings semantic inside each card.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-bg-surface", "color-border", "color-agent", "shadow-glow"],
			consumes: ["Badge", "Button", "Icon"],
			surfaces: ["HomeView", "FlowView", "ExecutionView"],
			a11y: ["semantic-heading", "action-grouping"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
