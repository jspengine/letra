import type { ReactNode, HTMLAttributes } from "react";

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
	sidebar?: ReactNode;
	header?: ReactNode;
	children?: ReactNode;
	sidebarCollapsed?: boolean;
}

export default function AppShell({
	sidebar,
	header,
	children,
	sidebarCollapsed = false,
	className,
	...rest
}: AppShellProps) {
	const shellClass = [
		"app-shell",
		sidebarCollapsed ? "app-shell--sidebar-collapsed" : "",
		className ?? "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={shellClass} {...rest}>
			<div className="app-shell__sidebar">{sidebar}</div>
			<div className="app-shell__header">{header}</div>
			<div className="app-shell__content">{children}</div>
		</div>
	);
}
