import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";
import { Icon } from "./icon";
import { MetadataRow } from "./metadata-row";
import { Tag } from "./tag";

const meta: Meta<typeof MetadataRow> = {
	title: "Components/MetadataRow",
	component: MetadataRow,
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Compact semantic metadata for IDs, stages, specs, owners, and timestamps. Use it when secondary facts need structure without competing with the main content.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["layout-inline-gap", "radius-sm", "color-border", "color-bg-sunken"],
			consumes: ["Badge", "Icon", "Tag"],
			surfaces: ["HomeView", "FlowView", "ItemSheet"],
			a11y: ["semantic-description-list", "labels-visible", "metadata-not-color-only"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};

export default meta;

type Story = StoryObj<typeof MetadataRow>;

export const FocusedWork: Story = {
	render: () => (
		<div className="max-w-3xl">
			<MetadataRow
				items={[
					{
						label: "Item",
						value: (
							<Badge icon="box" variant="info" tone="soft">
								ITEM-74
							</Badge>
						),
						icon: <Icon name="box" size={14} />,
					},
					{
						label: "Estagio",
						value: <Tag variant="success">Review</Tag>,
						icon: <Icon name="circle" size={14} />,
					},
					{
						label: "Spec",
						value: "ux-release-readiness",
						icon: <Icon name="file-text" size={14} />,
					},
					{
						label: "Idade",
						value: "5 dias",
						icon: <Icon name="clock" size={14} />,
					},
				]}
			/>
		</div>
	),
};

export const Minimal: Story = {
	render: () => (
		<div className="max-w-xl">
			<MetadataRow
				items={[
					{ label: "Origem", value: "health" },
					{
						label: "Severidade",
						value: (
							<Badge variant="amber" tone="soft">
								media
							</Badge>
						),
					},
				]}
			/>
		</div>
	),
};
