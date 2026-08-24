import type { Meta, StoryObj } from "@storybook/react";
import { ActionPanel } from "./action-panel";
import { Badge } from "./badge";
import { Button } from "./button";
import { Icon } from "./icon";
import { Tag } from "./tag";

const meta: Meta<typeof ActionPanel> = {
	title: "Components/ActionPanel",
	component: ActionPanel,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"High-priority action surface for the next safe user action. Prefer this over a generic Card when the page needs to answer what to do next.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: [
				"card-padding",
				"layout-toolbar-gap",
				"radius-md",
				"color-border",
				"color-bg-surface",
			],
			consumes: ["Badge", "Button", "Icon", "Tag"],
			surfaces: ["HomeView", "WorkspacesView"],
			a11y: ["clear-primary-action", "non-destructive-copy", "status-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};

export default meta;

type Story = StoryObj<typeof ActionPanel>;

export const NextSafeAction: Story = {
	render: () => (
		<ActionPanel
			tone="warning"
			icon={<Icon name="shield" size={20} />}
			title="Revisar decisão prioritária"
			description="Responder à solicitação sobre ITEM-74. A revisão abre a evidência do item; nenhuma mudança ocorre antes da sua decisão."
			meta={
				<>
					<Badge variant="amber" tone="soft" icon="alert-triangle">
						1 decisão
					</Badge>
					<Tag variant="warning">ação segura</Tag>
				</>
			}
			action={<Button>Revisar decisão</Button>}
			secondaryAction={<Button variant="secondary">Ver evidências</Button>}
		/>
	),
};

export const Informational: Story = {
	render: () => (
		<ActionPanel
			tone="info"
			icon={<Icon name="activity" size={20} />}
			title="Examinar evidências"
			description="Há alertas ativos no workspace. Comece pela atividade registrada para entender causa, origem e impacto antes de aplicar qualquer correção."
			meta={
				<Badge variant="info" tone="soft">
					4 alertas
				</Badge>
			}
			action={<Button variant="secondary">Abrir atividade</Button>}
		/>
	),
};

export const CompactGovernance: Story = {
	render: () => (
		<ActionPanel
			density="compact"
			tone="info"
			icon={<Icon name="file-text" size={20} />}
			title="Governança do workspace"
			description="Contexto canônico usado para interpretar decisões, evidências e trabalho em foco."
			meta={
				<>
					<Badge icon="file-text" variant="info" tone="soft">
						ux-release-readiness
					</Badge>
					<Tag variant="info">contrato ativo</Tag>
				</>
			}
		/>
	),
};
