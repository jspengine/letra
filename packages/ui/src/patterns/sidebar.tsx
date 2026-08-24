import type { ReactNode } from "react";
import { Icon } from "../icon";
import { cn } from "../utils";

type SidebarItem = {
	label: string;
	icon?: ReactNode;
	href?: string;
	active?: boolean;
	onClick?: () => void;
};

interface SidebarProps {
	items: SidebarItem[];
	collapsed?: boolean;
	onToggle?: () => void;
	className?: string;
}

function getItemColor(active?: boolean) {
	return active ? "var(--color-text-primary)" : "var(--color-text-secondary)";
}

export function Sidebar({ items, collapsed = false, onToggle, className }: SidebarProps) {
	return (
		<aside
			className={cn(
				"flex flex-col gap-[var(--space-2)] border-r bg-[var(--color-bg-surface)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
				collapsed ? "w-14" : "w-56",
				className,
			)}
			style={{ borderColor: "var(--color-border)" }}
		>
			<div
				className="flex items-center justify-between border-b px-[var(--space-3)] py-[var(--space-2)]"
				style={{ borderColor: "var(--color-border)" }}
			>
				{!collapsed && (
					<span
						className="text-h2 tracking-tight"
						style={{ color: "var(--color-text-primary)" }}
					>
						Letra
					</span>
				)}
				<button
					type="button"
					onClick={onToggle}
					className="inline-flex size-8 items-center justify-center rounded-[var(--radius-md)] text-caption transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-bg-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] cursor-pointer"
					style={{ color: "var(--color-text-secondary)" }}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					<Icon name={collapsed ? "chevron-right" : "chevron-left"} size={16} />
				</button>
			</div>
			<nav className="flex flex-col gap-[var(--space-1)] px-[var(--space-2)] py-[var(--space-2)]">
				{items.map((item) => (
					<button
						type="button"
						key={item.label}
						onClick={item.onClick}
						aria-label={collapsed ? item.label : undefined}
						className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-2)] text-body font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] cursor-pointer"
						style={{
							color: getItemColor(item.active),
							background: item.active ? "var(--color-bg-sunken)" : "transparent",
						}}
					>
						{item.icon && (
							<span className="flex size-[var(--icon-md)] shrink-0 items-center justify-center">
								{item.icon}
							</span>
						)}
						{!collapsed && <span className="truncate">{item.label}</span>}
					</button>
				))}
			</nav>
		</aside>
	);
}
