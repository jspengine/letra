import type { Meta, StoryObj } from "@storybook/react";
import { ToastProvider } from "@letra/ui";

import SupervisionInbox from "../../../client/src/components/Home/SupervisionInbox";
import type {
	ActivityEvent,
	AttentionSignal,
	FocusedWork,
	PendingDecision,
} from "../../../client/src/components/Home/SupervisionInbox";

import "../../../client/src/index.css";

const focusedWork: FocusedWork = {
	id: "ITEM-63",
	title: "Direcao de Agentes por Harness (Cross-Adapter)",
	stage: "Security",
	spec: "harness-agent-direction",
	ageLabel: "26 dias",
	actor: "Engenheiro de Seguranca",
};

const evidence: ActivityEvent[] = [
	{
		id: "event-validate-1",
		action: "validate",
		description: "Validacao executada — 2 passed, 0 failed, 617 warnings",
		timestamp: "2026-07-30T16:51:00.000Z",
		itemId: "ITEM-63",
	},
	{
		id: "event-build-1",
		action: "build",
		description: "Build do client concluido sem falhas",
		timestamp: "2026-07-30T16:44:00.000Z",
		itemId: "ITEM-63",
	},
];

const pendingDecision: PendingDecision = {
	itemId: "ITEM-75",
	title: "Aprovar avanço para revisão de segurança",
	stage: "Review",
	actor: "Reviewer",
	since: "ha 2h",
};

const activeSignal: AttentionSignal = {
	id: "health-validate",
	title: "Validacao com avisos recorrentes",
	source: "letra validate",
	severity: "media",
	status: "novo",
	detectedAt: "2026-07-30T16:51:00.000Z",
	impact: "pede investigacao",
	nextAction: "investigar",
	technicalType: "validation-warning",
};

type StoryProps = {
	decisions?: PendingDecision[];
	signals?: AttentionSignal[];
	healthSummary?: {
		novo: number;
		ciente: number;
		resolvido: number;
		descartado: number;
	};
	activity?: ActivityEvent[];
	signalsAvailable?: boolean;
	activityAvailable?: boolean;
	primaryWork?: FocusedWork;
	healthBusy?: boolean;
};

function StoryFrame(props: StoryProps) {
	return (
		<ToastProvider>
			<div className="app-surface-base min-h-[900px] w-full overflow-auto bg-[var(--color-bg-base)] p-[var(--layout-page-padding)]">
				<SupervisionInbox
					decisions={props.decisions ?? []}
					signals={props.signals ?? []}
					healthSummary={props.healthSummary}
					activity={props.activity ?? evidence}
					signalsAvailable={props.signalsAvailable}
					activityAvailable={props.activityAvailable}
					primaryWork={props.primaryWork ?? focusedWork}
					onReviewDecision={() => {}}
					onOpenItem={() => {}}
					onOpenActivity={() => {}}
					onOpenWork={() => {}}
					onOpenSignal={() => {}}
					onScanHealth={() => {}}
					healthBusy={props.healthBusy}
				/>
			</div>
		</ToastProvider>
	);
}

const meta = {
	title: "Surfaces/SupervisionInbox",
	component: StoryFrame,
	parameters: {
		layout: "fullscreen",
		"x-ds": {
			category: "surface",
			status: "ready",
			intent: "Canonical supervision surface states for human decisions, active health signals, focused work, and evidence.",
			sourceOfTruth: "packages/client/src/components/Home/SupervisionInbox.tsx",
			tokens: ["color-bg-base", "color-bg-surface", "color-text-primary", "color-primary", "radius-md"],
			consumes: ["ActionPanel", "Badge", "Button", "Card", "EmptyState", "Icon", "List", "MetadataRow", "Tag"],
			states: ["empty", "pending-decision", "active-health-signal", "health-unavailable"],
			a11y: ["landmarks", "button-labels", "empty-states"],
			breakpoints: ["mobile", "desktop"],
		},
	},
} satisfies Meta<typeof StoryFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SemPendencias: Story = {
	args: {
		decisions: [],
		signals: [],
		healthSummary: { novo: 0, ciente: 0, resolvido: 45, descartado: 5 },
		activity: evidence,
	},
};

export const DecisaoHumanaPendente: Story = {
	args: {
		decisions: [pendingDecision],
		signals: [],
		healthSummary: { novo: 0, ciente: 0, resolvido: 45, descartado: 5 },
		activity: evidence,
	},
};

export const SinalAtivoDeSaude: Story = {
	args: {
		decisions: [],
		signals: [activeSignal],
		healthSummary: { novo: 1, ciente: 0, resolvido: 45, descartado: 5 },
		activity: evidence,
	},
};

export const SaudeIndisponivel: Story = {
	args: {
		decisions: [],
		signals: [],
		signalsAvailable: false,
		healthBusy: true,
		activity: evidence,
	},
};
