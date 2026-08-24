import "./index.css";
import { Badge } from "./badge";
import { Button } from "./button";
import { Icon } from "./icon";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "./sheet";

export const Right = () => (
	<Sheet>
		{({ setOpen }) => (
			<>
				<SheetTrigger onClick={() => setOpen(true)}>Open right sheet</SheetTrigger>
				<SheetContent side="right">
					<SheetHeader>
						<div>
							<SheetTitle>Agent details</SheetTitle>
							<SheetDescription>
								Runtime, current command, and latest evidence.
							</SheetDescription>
						</div>
						<SheetClose aria-label="Close sheet" onClick={() => setOpen(false)}>
							Close
						</SheetClose>
					</SheetHeader>
					<div className="flex flex-1 flex-col gap-[var(--space-3)] p-[var(--space-4)] text-body-sm">
						<span>agent-triage-01 is reasoning through ITEM-76.</span>
						<span className="text-[var(--color-text-secondary)]">
							Last heartbeat 2 seconds ago.
						</span>
					</div>
					<SheetFooter>
						<Button variant="secondary" onClick={() => setOpen(false)}>
							Dismiss
						</Button>
						<Button>Open logs</Button>
					</SheetFooter>
				</SheetContent>
			</>
		)}
	</Sheet>
);

export const Left = () => (
	<Sheet>
		{({ setOpen }) => (
			<>
				<SheetTrigger onClick={() => setOpen(true)}>Open left sheet</SheetTrigger>
				<SheetContent side="left">
					<SheetHeader>
						<div>
							<SheetTitle>Workspace navigation</SheetTitle>
							<SheetDescription>
								Contextual navigation for supervision surfaces.
							</SheetDescription>
						</div>
					</SheetHeader>
					<div className="flex flex-1 flex-col gap-[var(--space-2)] p-[var(--space-4)] text-body-sm">
						<span>Home</span>
						<span>Flow</span>
						<span>Execution</span>
					</div>
				</SheetContent>
			</>
		)}
	</Sheet>
);

export const EvidenceDetail = () => (
	<Sheet>
		{({ setOpen }) => (
			<>
				<SheetTrigger onClick={() => setOpen(true)}>Open evidence detail</SheetTrigger>
				<SheetContent side="right" className="w-full sm:max-w-3xl lg:max-w-4xl">
					<SheetHeader>
						<div className="min-w-0">
							<SheetTitle>Evidence detail</SheetTitle>
							<SheetDescription>
								Investigation summary, related evidence, and technical data for one
								activity.
							</SheetDescription>
						</div>
						<SheetClose
							aria-label="Close evidence detail"
							onClick={() => setOpen(false)}
						>
							<Icon name="x" size={16} />
						</SheetClose>
					</SheetHeader>
					<div className="flex flex-1 flex-col gap-[var(--space-5)] overflow-y-auto p-[var(--space-6)] text-body-sm">
						<section className="grid gap-[var(--space-2)]">
							<div className="flex flex-wrap items-center gap-[var(--space-2)]">
								<Badge variant="info" tone="soft">
									system
								</Badge>
								<Badge variant="success" tone="soft">
									completed
								</Badge>
							</div>
							<p className="max-w-3xl text-body-sm text-[var(--color-text-primary)]">
								Automation registered a validation event for ITEM-74. Result:
								evidence was collected before any state mutation.
							</p>
						</section>
						<section className="grid gap-[var(--space-3)]">
							<h3 className="text-caption font-semibold uppercase text-[var(--color-text-secondary)]">
								Related evidence
							</h3>
							<div className="flex flex-wrap gap-[var(--space-2)]">
								<Badge variant="info" tone="soft" icon="box">
									ITEM-74
								</Badge>
								<Badge variant="info" tone="soft">
									AC8
								</Badge>
								<Badge variant="info" tone="soft">
									activity.log
								</Badge>
							</div>
						</section>
						<section className="grid gap-[var(--space-3)]">
							<h3 className="text-caption font-semibold uppercase text-[var(--color-text-secondary)]">
								Technical details
							</h3>
							<pre className="max-h-72 overflow-auto rounded-[var(--radius-sm)] bg-[var(--color-bg-base)] p-[var(--space-4)] text-caption text-[var(--color-text-secondary)]">
								{JSON.stringify(
									{
										outcome: "completed",
										source: "letra validate",
										itemId: "ITEM-74",
									},
									null,
									2,
								)}
							</pre>
						</section>
					</div>
				</SheetContent>
			</>
		)}
	</Sheet>
);

export default {
	title: "Components/Sheet",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Side-panel primitive for contextual details without leaving the active supervision surface. Use wider right-side sheets for evidence/detail inspection, always provide title text, and keep a single close affordance reachable by keyboard.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["color-bg-surface", "color-border", "motion-slow"],
			consumes: ["Button"],
			surfaces: ["ExecutionView", "ContextView", "WorkspacesView", "AuditLogView"],
			a11y: ["role-dialog", "aria-modal", "title-required"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
