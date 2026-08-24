import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils";

function NavigationMenu({ className, ...props }: NavigationMenuPrimitive.Root.Props) {
	return (
		<NavigationMenuPrimitive.Root
			data-slot="navigation-menu"
			className={cn("relative flex max-w-max items-center justify-center", className)}
			{...props}
		/>
	);
}

function NavigationMenuList({ className, ...props }: NavigationMenuPrimitive.List.Props) {
	return (
		<NavigationMenuPrimitive.List
			data-slot="navigation-menu-list"
			className={cn("flex list-none items-center gap-[var(--space-1)]", className)}
			{...props}
		/>
	);
}

const NavigationMenuItem = NavigationMenuPrimitive.Item;

function NavigationMenuTrigger({
	className,
	children,
	...props
}: NavigationMenuPrimitive.Trigger.Props) {
	return (
		<NavigationMenuPrimitive.Trigger
			data-slot="navigation-menu-trigger"
			className={cn(
				"group inline-flex h-9 items-center justify-center gap-[var(--space-1)] rounded-[var(--radius-md)] px-[var(--space-3)] text-body-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)] data-popup-open:bg-[var(--surface-selected)]",
				className,
			)}
			{...props}
		>
			{children}
			<NavigationMenuPrimitive.Icon>
				<ChevronDown
					aria-hidden="true"
					className="size-[var(--icon-sm)] transition-transform group-data-popup-open:rotate-180"
				/>
			</NavigationMenuPrimitive.Icon>
		</NavigationMenuPrimitive.Trigger>
	);
}

function NavigationMenuContent({ className, ...props }: NavigationMenuPrimitive.Content.Props) {
	return (
		<NavigationMenuPrimitive.Content
			data-slot="navigation-menu-content"
			className={cn("p-[var(--space-2)]", className)}
			{...props}
		/>
	);
}

function NavigationMenuLink({ className, ...props }: NavigationMenuPrimitive.Link.Props) {
	return (
		<NavigationMenuPrimitive.Link
			data-slot="navigation-menu-link"
			className={cn(
				"block rounded-[var(--radius-md)] p-[var(--space-2)] text-body-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]",
				className,
			)}
			{...props}
		/>
	);
}

function NavigationMenuViewport({ className, ...props }: NavigationMenuPrimitive.Viewport.Props) {
	return (
		<NavigationMenuPrimitive.Portal>
			<NavigationMenuPrimitive.Positioner sideOffset={8}>
				<NavigationMenuPrimitive.Popup
					data-slot="navigation-menu-popup"
					className="rounded-[var(--radius-md)] border-[length:var(--border-thin)] border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-lg outline-none"
				>
					<NavigationMenuPrimitive.Viewport
						data-slot="navigation-menu-viewport"
						className={cn("relative min-w-56 overflow-hidden", className)}
						{...props}
					/>
				</NavigationMenuPrimitive.Popup>
			</NavigationMenuPrimitive.Positioner>
		</NavigationMenuPrimitive.Portal>
	);
}

export {
	NavigationMenu,
	NavigationMenuList,
	NavigationMenuItem,
	NavigationMenuTrigger,
	NavigationMenuContent,
	NavigationMenuLink,
	NavigationMenuViewport,
};
