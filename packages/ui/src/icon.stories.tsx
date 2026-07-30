import "./index.css";
import { Icon, type IconName } from "./icon";

export const Sizes = () => (
	<div className="flex items-center gap-[var(--space-3)] p-[var(--space-4)]">
		<Icon name="home" size={10} />
		<Icon name="home" size={14} />
		<Icon name="home" size={16} />
		<Icon name="home" size={20} />
		<Icon name="home" size={24} />
	</div>
);

export const Gallery = () => (
	<div className="flex flex-wrap gap-[var(--space-3)] p-[var(--space-4)]">
		<Icon name="home" size={20} />
		<Icon name="search" size={20} />
		<Icon name="settings" size={20} />
		<Icon name="user" size={20} />
		<Icon name="star" size={20} />
		<Icon name="edit" size={20} />
		<Icon name="trash" size={20} />
		<Icon name="plus" size={20} />
		<Icon name="check" size={20} />
		<Icon name="cross" size={20} />
		<Icon name="x" size={20} />
		<Icon name="info" size={20} />
		<Icon name="help" size={20} />
		<Icon name="clock" size={20} />
		<Icon name="folder" size={20} />
		<Icon name="box" size={20} />
		<Icon name="code" size={20} />
		<Icon name="cpu" size={20} />
		<Icon name="book" size={20} />
		<Icon name="shield" size={20} />
		<Icon name="activity" size={20} />
		<Icon name="copy" size={20} />
		<Icon name="circle" size={20} />
		<Icon name="sun" size={20} />
		<Icon name="moon" size={20} />
		<Icon name="grid" size={20} />
		<Icon name="flow" size={20} />
		<Icon name="workflow" size={20} />
		<Icon name="context" size={20} />
		<Icon name="specs" size={20} />
		<Icon name="bar-chart" size={20} />
		<Icon name="file-text" size={20} />
		<Icon name="pen-tool" size={20} />
		<Icon name="git-branch" size={20} />
		<Icon name="chevron-down" size={20} />
		<Icon name="chevron-up" size={20} />
		<Icon name="chevron-left" size={20} />
		<Icon name="chevron-right" size={20} />
		<Icon name="arrow-up" size={20} />
		<Icon name="list-three" size={20} />
		<Icon name="alert-triangle" size={20} />
		<Icon name="x-circle" size={20} />
		<Icon name="check-circle" size={20} />
		<Icon name="alert-circle" size={20} />
	</div>
);

const domainIcons: Array<{ concept: string; icons: IconName[]; color: string; token: string }> = [
	{ concept: "Agente / raciocínio de IA", icons: ["bot", "sparkles"], color: "var(--color-agent)", token: "color-agent" },
	{ concept: "Execução ativa", icons: ["activity", "zap"], color: "var(--color-primary)", token: "color-primary" },
	{ concept: "Pipeline / orquestração", icons: ["workflow", "git-branch"], color: "var(--color-info)", token: "color-info" },
	{ concept: "Logs / terminal", icons: ["terminal", "scroll-text"], color: "var(--color-text-secondary)", token: "color-text-secondary" },
	{ concept: "Sucesso", icons: ["circle-check"], color: "var(--color-success)", token: "color-success" },
	{ concept: "Erro / bloqueio", icons: ["circle-x", "octagon-alert"], color: "var(--color-danger)", token: "color-danger" },
	{ concept: "Aprovação pendente", icons: ["clock", "hourglass"], color: "var(--color-primary)", token: "color-primary" },
	{ concept: "Conector / MCP", icons: ["plug"], color: "var(--color-info)", token: "color-info" },
	{ concept: "Configuração", icons: ["settings-2", "sliders-horizontal"], color: "var(--color-text-secondary)", token: "color-text-secondary" },
];

export const DomainMapping = () => (
	<div className="grid max-w-3xl gap-[var(--space-2)] p-[var(--space-4)]">
		{domainIcons.map((entry) => (
			<div
				key={entry.concept}
				className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-[var(--space-3)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-[var(--space-3)] py-[var(--space-2)]"
			>
				<span className="text-body-sm font-medium text-[var(--color-text-primary)]">{entry.concept}</span>
				<span className="flex items-center gap-[var(--space-2)]" style={{ color: entry.color }}>
					{entry.icons.map((name) => (
						<Icon key={name} name={name} size={18} />
					))}
				</span>
				<span className="text-caption text-[var(--color-text-secondary)]">{entry.token}</span>
			</div>
		))}
	</div>
);

export const BrandColor = () => (
	<div className="flex gap-[var(--space-3)] p-[var(--space-4)] text-[var(--primary)]">
		<Icon name="star" size={24} />
		<Icon name="check" size={24} />
		<Icon name="settings" size={24} />
		<Icon name="activity" size={24} />
	</div>
);

export default {
	title: "Components/Icon",
	tags: ["autodocs"],
	parameters: {
		docs: {
			description: {
				component:
					"Icon primitive backed by the project icon library. Use canonical icon sizes and pair icons with visible text for critical actions.",
			},
		},
		"x-ds": {
			category: "primitive",
			status: "ready",
			tokens: ["icon-xs", "icon-sm", "icon-md", "icon-lg", "color-primary", "color-agent", "color-info", "color-success", "color-danger", "color-text-secondary"],
			consumes: [],
			surfaces: ["HomeView", "FlowView", "ExecutionView", "SpecsView"],
			a11y: ["decorative-by-default", "pair-with-label-for-actions"],
			breakpoints: ["mobile", "desktop"],
		},
	},
};
