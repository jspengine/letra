import {
	useState,
	useRef,
	useEffect,
	type HTMLAttributes,
	type ButtonHTMLAttributes,
	type KeyboardEvent,
} from "react";
import { cn } from "./utils";

interface DropdownMenuProps {
	children: React.ReactNode | ((props: { open: boolean; setOpen: (v: boolean) => void }) => React.ReactNode);
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function DropdownMenu({ children, open, onOpenChange }: DropdownMenuProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = open !== undefined;
	const isOpen = isControlled ? open : internalOpen;

	const setOpen = (v: boolean) => {
		if (!isControlled) setInternalOpen(v);
		onOpenChange?.(v);
	};

	return (
		<div className="relative inline-block">
			{typeof children === "function"
				? (children as (props: { open: boolean; setOpen: (v: boolean) => void }) => React.ReactNode)({ open: isOpen, setOpen })
				: children}
		</div>
	);
}

interface DropdownMenuTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean;
}

export function DropdownMenuTrigger({
	className,
	asChild,
	children,
	...props
}: DropdownMenuTriggerProps) {
	if (asChild) {
		return <>{children}</>;
	}
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center gap-[var(--space-1)] rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-1)] text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30",
				className,
			)}
			type="button"
			aria-haspopup="true"
			{...props}
		>
			{children}
		</button>
	);
}

interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
	align?: "start" | "center" | "end";
	sideOffset?: number;
}

export function DropdownMenuContent({
	className,
	align = "start",
	sideOffset = 4,
	children,
	...props
}: DropdownMenuContentProps) {
	const alignStyles: Record<string, string> = {
		start: "left-0",
		center: "left-1/2 -translate-x-1/2",
		end: "right-0",
	};

	return (
		<div
			className={cn(
				"absolute z-50 min-w-[8rem] overflow-hidden rounded-[var(--radius-md)] border-[length:var(--border-thin)] bg-card p-[var(--space-2)] shadow-md",
				alignStyles[align],
				className,
			)}
			style={{ top: `calc(100% + ${sideOffset}px)`, borderColor: "var(--border)", background: "var(--card)" }}
			role="menu"
			{...props}
		>
			{children}
		</div>
	);
}

interface DropdownMenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	inset?: boolean;
}

export function DropdownMenuItem({
	className,
	inset,
	children,
	...props
}: DropdownMenuItemProps) {
	return (
		<button
			className={cn(
				"relative flex w-full cursor-default select-none items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-sm outline-none transition-colors hover:bg-muted focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				inset && "pl-[var(--space-3)]",
				className,
			)}
			role="menuitem"
			type="button"
			{...props}
		>
			{children}
		</button>
	);
}

export function DropdownMenuSeparator({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	);
}

interface DropdownMenuLabelProps extends HTMLAttributes<HTMLDivElement> {
	inset?: boolean;
}

export function DropdownMenuLabel({
	className,
	inset,
	children,
	...props
}: DropdownMenuLabelProps) {
	return (
		<div
			className={cn(
				"px-[var(--space-2)] py-[var(--space-1)] text-xs font-semibold text-muted-foreground",
				inset && "pl-[var(--space-3)]",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}