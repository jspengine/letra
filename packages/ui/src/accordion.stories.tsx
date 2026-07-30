import "./index.css";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
import { Badge } from "./badge";

export const Default = () => (
	<Accordion>
		<AccordionItem>
			<AccordionTrigger>What is Letra?</AccordionTrigger>
			<AccordionContent>
				A workflow orchestration tool for AI agents. It maps SDLC phases to stages, gates, and roles.
			</AccordionContent>
		</AccordionItem>
		<AccordionItem>
			<AccordionTrigger>How does it work?</AccordionTrigger>
			<AccordionContent>
				It keeps workflow, specs, gates, and evidence visible so a human can supervise the work.
			</AccordionContent>
		</AccordionItem>
		<AccordionItem>
			<AccordionTrigger>Is it open source?</AccordionTrigger>
			<AccordionContent>Yes, MIT licensed.</AccordionContent>
		</AccordionItem>
	</Accordion>
);

export const Rich = () => (
	<Accordion>
		<AccordionItem>
			<AccordionTrigger>
				<span className="flex items-center gap-[var(--space-2)]">
					<Badge variant="success">healthy</Badge>
					Pipeline status
				</span>
			</AccordionTrigger>
			<AccordionContent>
				<div className="flex flex-col gap-[var(--space-2)] text-sm text-[var(--color-text-secondary)]">
					<span>All gates are passing.</span>
					<span>Last deploy: 2 hours ago.</span>
				</div>
			</AccordionContent>
		</AccordionItem>
		<AccordionItem>
			<AccordionTrigger>
				<span className="flex items-center gap-[var(--space-2)]">
					<Badge variant="amber">review</Badge>
					Warnings review
				</span>
			</AccordionTrigger>
			<AccordionContent>
				<div className="flex flex-col gap-[var(--space-3)]">
					<p className="text-sm text-[var(--color-text-secondary)]">
						There are 2 warnings that need review before the next transition.
					</p>
					<p className="text-sm text-[var(--color-text-secondary)]">
						Open the details to inspect the affected artifact and suggested remediation.
					</p>
				</div>
			</AccordionContent>
		</AccordionItem>
		<AccordionItem>
			<AccordionTrigger>
				<span className="flex items-center gap-[var(--space-2)]">
					<Badge variant="error">blocked</Badge>
					Blocked deploy
				</span>
			</AccordionTrigger>
			<AccordionContent>
				<div className="flex flex-col gap-[var(--space-3)]">
					<p className="text-sm text-[var(--color-text-primary)]">
						Deployment is blocked because the security clearance gate is not approved yet.
					</p>
					<p className="text-sm text-[var(--color-text-secondary)]">
						Ask the security reviewer to run <code className="font-mono text-xs">letra gate approve security-clear</code>.
					</p>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
);

export default {
	title: "Components/Accordion",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Disclosure primitive for stacked explanatory or diagnostic content. Use it when sections can be scanned independently and only one level of expansion is needed.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-border", "color-text-primary", "color-text-secondary", "duration-fast"],
			consumes: ["Badge"],
			surfaces: ["ContextView", "SpecsView", "WorkspacesView"],
			a11y: ["button-trigger", "expanded-state", "keyboard-navigation"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
