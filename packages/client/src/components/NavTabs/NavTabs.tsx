import { Icon, Tabs } from "@letra/ui";
import type { IconName } from "@letra/ui";

export type Tab = "home" | "specs" | "flow" | "context" | "logs";

interface Props {
	activeTab: Tab;
	onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: IconName }[] = [
	{ id: "home", label: "Home", icon: "home" },
	{ id: "specs", label: "Specs", icon: "specs" },
	{ id: "flow", label: "Flow", icon: "flow" },
	{ id: "context", label: "Context", icon: "context" },
	{ id: "logs", label: "Logs", icon: "search" },
];

export function NavTabs({ activeTab, onTabChange }: Props) {
	return (
		<nav aria-label="Navegação principal">
			<Tabs
				tabs={TABS.map((tab) => ({
					id: tab.id,
					label: tab.label,
					icon: <Icon name={tab.icon} size={16} />,
				}))}
				activeTab={activeTab}
				onChange={(id) => onTabChange(id as Tab)}
				ariaLabel="Navegação principal"
			/>
		</nav>
	);
}
