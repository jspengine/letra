import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ButtonHTMLAttributes,
	type CSSProperties,
	type HTMLAttributes,
	type ReactNode,
} from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { Sheet, SheetContent } from "./sheet";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

interface SidebarContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	state: "expanded" | "collapsed";
	toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const query = window.matchMedia("(max-width: 767px)");
		const update = () => setIsMobile(query.matches);
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	}, []);

	return isMobile;
}

interface SidebarProviderProps extends HTMLAttributes<HTMLDivElement> {
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function SidebarProvider({
	defaultOpen = true,
	open,
	onOpenChange,
	className,
	style,
	children,
	...props
}: SidebarProviderProps) {
	const isMobile = useIsMobile();
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const [openMobile, setOpenMobile] = useState(false);
	const isControlled = open !== undefined;
	const sidebarOpen = isControlled ? open : internalOpen;

	const setOpen = useCallback(
		(value: boolean) => {
			if (!isControlled) setInternalOpen(value);
			onOpenChange?.(value);
		},
		[isControlled, onOpenChange],
	);

	const toggleSidebar = useCallback(() => {
		if (isMobile) {
			setOpenMobile((value) => !value);
			return;
		}
		setOpen(!sidebarOpen);
	}, [isMobile, setOpen, sidebarOpen]);

	const value = useMemo<SidebarContextValue>(
		() => ({
			open: sidebarOpen,
			setOpen,
			openMobile,
			setOpenMobile,
			isMobile,
			state: sidebarOpen ? "expanded" : "collapsed",
			toggleSidebar,
		}),
		[isMobile, openMobile, setOpen, sidebarOpen, toggleSidebar],
	);

	return (
		<SidebarContext.Provider value={value}>
			<div
				data-sidebar-wrapper
				className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)}
				style={
					{
						"--sidebar-width": "18rem",
						"--sidebar-width-icon": "3rem",
						...style,
					} as CSSProperties
				}
				{...props}
			>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}

export function useSidebar() {
	const context = useContext(SidebarContext);
	if (!context) throw new Error("useSidebar must be used within SidebarProvider.");
	return context;
}

interface AppSidebarProps extends HTMLAttributes<HTMLElement> {
	side?: "left" | "right";
	collapsible?: "offcanvas" | "icon" | "none";
	children: ReactNode;
}

export function AppSidebar({
	side = "left",
	collapsible = "icon",
	className,
	children,
	...props
}: AppSidebarProps) {
	const { open, openMobile, setOpenMobile, isMobile } = useSidebar();

	if (isMobile) {
		return (
			<Sheet open={openMobile} onOpenChange={setOpenMobile}>
				<SheetContent side={side} className="w-[var(--sidebar-width)] max-w-[88vw] p-0">
					<div className="flex h-full w-full flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)]">
						{children}
					</div>
				</SheetContent>
			</Sheet>
		);
	}

	return (
		<aside
			data-sidebar="sidebar"
			data-state={open ? "expanded" : "collapsed"}
			data-collapsible={open ? "" : collapsible}
			data-side={side}
			className={cn(
				"relative z-[var(--z-sticky)] hidden h-full min-h-svh shrink-0 overflow-visible border-r bg-[var(--color-sidebar)] text-[var(--color-sidebar-foreground)] transition-[width] duration-[var(--motion-base)] ease-[var(--ease-standard)] md:flex md:flex-col",
				open ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-width-icon)]",
				side === "right" && "border-l border-r-0",
				className,
			)}
			style={{ borderColor: "var(--app-sidebar-border, var(--color-sidebar-border))" }}
			{...props}
		>
			{children}
		</aside>
	);
}

export function SidebarTrigger({
	className,
	onClick,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	const { toggleSidebar } = useSidebar();

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className={cn("size-8 px-0", className)}
			onClick={(event) => {
				toggleSidebar();
				onClick?.(event);
			}}
			{...props}
		>
			<Icon name="list-three" size={16} />
			<span className="sr-only">Alternar navegação</span>
		</Button>
	);
}

export function SidebarHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("flex shrink-0 items-center gap-2", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	const { open } = useSidebar();
	return (
		<div
			className={cn(
				"flex min-h-0 flex-1 flex-col overflow-y-auto",
				open ? "p-2" : "px-1 py-2",
				className,
			)}
			{...props}
		/>
	);
}

export function SidebarGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	const { open } = useSidebar();
	return (
		<div
			className={cn("grid gap-2 py-2", !open && "justify-items-center", className)}
			{...props}
		/>
	);
}

export function SidebarGroupContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	const { open } = useSidebar();
	return (
		<div className={cn("grid gap-1", !open && "justify-items-center", className)} {...props} />
	);
}

export function SidebarGroupLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	const { open } = useSidebar();
	return (
		<div
			className={cn(
				"px-2 text-caption font-semibold uppercase text-[var(--color-text-secondary)] transition-[opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
				!open && "sr-only",
				className,
			)}
			{...props}
		/>
	);
}

export function SidebarMenu({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
	const { open } = useSidebar();
	return (
		<ul className={cn("grid gap-1", !open && "justify-items-center", className)} {...props} />
	);
}

export function SidebarMenuItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
	const { open } = useSidebar();
	return <li className={cn("min-w-0", !open && "size-9", className)} {...props} />;
}

interface SidebarMenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	isActive?: boolean;
	tooltip?: string;
}

export function SidebarMenuButton({
	isActive,
	tooltip,
	className,
	children,
	...props
}: SidebarMenuButtonProps) {
	const { open } = useSidebar();
	const button = (
		<button
			type="button"
			data-active={isActive ? "true" : undefined}
			className={cn(
				"group/sidebar-menu-button flex h-9 w-full min-w-0 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-medium text-[var(--color-sidebar-foreground)] transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
				"hover:bg-[var(--color-sidebar-accent)] hover:text-[var(--color-sidebar-accent-foreground)] hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]",
				"active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
				isActive &&
					"bg-[var(--color-sidebar-accent)] text-[var(--color-sidebar-accent-foreground)] border border-[var(--app-sidebar-border,var(--color-sidebar-border))]",
				!open && "size-9 justify-center px-0",
				className,
			)}
			title={!open ? tooltip : undefined}
			{...props}
		>
			{children}
		</button>
	);

	if (open || !tooltip) return button;

	return (
		<Tooltip content={tooltip} position="right" className="w-full">
			{button}
		</Tooltip>
	);
}
