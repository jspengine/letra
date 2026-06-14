import { cn } from "../../lib/utils";
import { Icon } from "@letra/ui";
import type { IconName } from "@letra/ui";

type Tab = "home" | "specs" | "flow" | "context";

interface Props {
	activeTab: Tab;
	onTabChange: (tab: Tab) => void;
}

const TABS: { id: Tab; label: string; icon: IconName }[] = [
	{ id: "home", label: "Home", icon: "home" },
	{ id: "specs", label: "Specs", icon: "specs" },
	{ id: "flow", label: "Flow", icon: "flow" },
	{ id: "context", label: "Context", icon: "context" },
];

export function NavTabs({ activeTab, onTabChange }: Props) {
	return (
		<nav
			className="flex gap-1 px-4 py-2 border-b"
			style={{ borderColor: "var(--border)" }}
			role="tablist"
			aria-label="Main navigation"
		>
			{TABS.map((tab) => (
				<button
					key={tab.id}
					role="tab"
					aria-selected={activeTab === tab.id}
					aria-controls={`panel-${tab.id}`}
					id={`tab-${tab.id}`}
					onClick={() => onTabChange(tab.id)}
					className={cn(
						"flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
						activeTab === tab.id
							? "bg-primary/10 text-primary border-b-2 border-primary"
							: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
					)}
				>
					<Icon name={tab.icon} size={16} />
					{tab.label}
				</button>
			))}
		</nav>
	);
}
