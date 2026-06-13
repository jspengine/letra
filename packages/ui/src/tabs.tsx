import { useState, type ReactNode } from "react";
import { cn } from "./utils";

interface Tab {
	id: string;
	label: string;
	icon?: ReactNode;
}

interface TabsProps {
	tabs: Tab[];
	activeTab?: string;
	onChange?: (id: string) => void;
	children?: (activeId: string) => ReactNode;
	className?: string;
}

export function Tabs({ tabs, activeTab: controlledTab, onChange, children, className }: TabsProps) {
	const [internalTab, setInternalTab] = useState(tabs[0]?.id || "");
	const active = controlledTab ?? internalTab;

	function handleSelect(id: string) {
		if (!controlledTab) setInternalTab(id);
		onChange?.(id);
	}

	return (
		<div className={cn("flex flex-col h-full", className)}>
			<div
				className="flex border-b shrink-0"
				style={{ borderColor: "var(--border)" }}
				role="tablist"
			>
				{tabs.map((tab) => (
					<button
						key={tab.id}
						role="tab"
						aria-selected={active === tab.id}
						onClick={() => handleSelect(tab.id)}
						className={cn(
							"flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer",
							active === tab.id
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
						style={{
							color: active === tab.id ? "var(--primary)" : "var(--muted-foreground)",
							borderColor: active === tab.id ? "var(--primary)" : "transparent",
						}}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>
			{children && (
				<div className="flex-1 overflow-y-auto">
					{children(active)}
				</div>
			)}
		</div>
	);
}
