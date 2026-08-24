import { type ReactNode, useState } from "react";
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
	ariaLabel?: string;
}

export function Tabs({
	tabs,
	activeTab: controlledTab,
	onChange,
	children,
	className,
	ariaLabel,
}: TabsProps) {
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
				style={{ borderColor: "var(--color-border)" }}
				role="tablist"
				aria-label={ariaLabel}
			>
				{tabs.map((tab) => (
					<button
						type="button"
						key={tab.id}
						role="tab"
						aria-selected={active === tab.id}
						onClick={() => handleSelect(tab.id)}
						className={cn(
							"flex items-center gap-[var(--space-1)] px-[var(--space-3)] py-[var(--space-2)] text-body font-medium transition-colors border-b-2 -mb-px cursor-pointer",
							active === tab.id
								? "border-[var(--color-primary)]"
								: "border-transparent",
						)}
						style={{
							color:
								active === tab.id
									? "var(--color-primary)"
									: "var(--color-text-secondary)",
						}}
					>
						{tab.icon}
						{tab.label}
					</button>
				))}
			</div>
			{children && <div className="flex-1 overflow-y-auto">{children(active)}</div>}
		</div>
	);
}
