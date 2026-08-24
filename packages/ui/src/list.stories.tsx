import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Icon } from "./icon";
import { List, ListItem } from "./list";
import { Tag } from "./tag";

const meta: Meta<typeof List> = {
	title: "Components/List",
	component: List,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Structured list pattern for decision queues, health signals, metadata rows, and compact evidence lists. Use it instead of ad hoc bordered divs inside cards.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: [
				"layout-list-gap",
				"layout-list-item-padding",
				"radius-sm",
				"color-border",
				"surface-hover",
			],
			consumes: ["Badge", "Tag", "Button", "Icon"],
			surfaces: ["HomeView", "FlowView", "Diagnostics"],
			a11y: ["semantic-list", "action-per-item", "metadata-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};

export default meta;

type Story = StoryObj<typeof List>;

export const DecisionQueue: Story = {
	render: () => (
		<div className="max-w-3xl">
			<List>
				<ListItem
					leading={<Icon name="shield" size={18} />}
					title="Aprovar gate de release readiness"
					description="Solicita sua decisão antes de mover o item para Done."
					meta={
						<>
							<Badge variant="info" tone="soft" icon="box">
								ITEM-74
							</Badge>
							<Tag variant="warning">Review</Tag>
							<Tag>há 5d</Tag>
						</>
					}
					action={<Button size="sm">Revisar</Button>}
					tone="warning"
				/>
				<ListItem
					leading={<Icon name="alert-triangle" size={18} />}
					title="AC stale detectado"
					description="O detector encontrou divergência entre marcação do AC e implementação."
					meta={
						<Badge variant="amber" tone="soft">
							health
						</Badge>
					}
					action={
						<Button variant="secondary" size="sm">
							Ver evidência
						</Button>
					}
					tone="info"
				/>
			</List>
		</div>
	),
};

export const DenseMetadata: Story = {
	render: () => (
		<div className="max-w-2xl">
			<List tone="surface">
				<ListItem
					title="ITEM-29"
					description="Central de Diagnósticos e Alertas de Saúde do Letra"
					meta={
						<>
							<Tag variant="info">Backlog</Tag>
							<Tag>ux-release-readiness</Tag>
						</>
					}
				/>
				<ListItem
					title="ITEM-74"
					description="Consolidar Atividade como trilha investigativa e de evidência"
					meta={
						<>
							<Tag variant="success">Review</Tag>
							<Tag>8/8 ACs</Tag>
						</>
					}
				/>
			</List>
		</div>
	),
};
