import { useState, useRef, useEffect, type HTMLAttributes, type ButtonHTMLAttributes, useCallback } from "react";
import { cn } from "./utils";

// ── Sheet Root ──
interface SheetProps {
	children: React.ReactNode | ((props: { open: boolean; setOpen: (v: boolean) => void }) => React.ReactNode);
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function Sheet({ children, open, onOpenChange }: SheetProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = open !== undefined;
	const isOpen = isControlled ? open : internalOpen;

	const setOpen = useCallback((v: boolean) => {
		if (!isControlled) setInternalOpen(v);
		onOpenChange?.(v);
	}, [isControlled, onOpenChange]);

	return (
		<>
			{typeof children === "function"
				? (children as (props: { open: boolean; setOpen: (v: boolean) => void }) => React.ReactNode)({ open: isOpen, setOpen })
				: children}
		</>
	);
}

// ── Trigger ──
interface SheetTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean;
}

export function SheetTrigger({ className, asChild, children, ...props }: SheetTriggerProps) {
	if (asChild) return <>{children}</>;
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30",
				className,
			)}
			type="button"
			{...props}
		>
			{children}
		</button>
	);
}

// ── Content ──
interface SheetContentProps extends HTMLAttributes<HTMLDivElement> {
	side?: "top" | "bottom" | "left" | "right";
}

export function SheetContent({
	className,
	side = "right",
	children,
	...props
}: SheetContentProps) {
	const sideStyles: Record<string, string> = {
		top: "inset-x-0 top-0 border-b",
		bottom: "inset-x-0 bottom-0 border-t",
		left: "inset-y-0 left-0 border-r",
		right: "inset-y-0 right-0 border-l",
	};

	return (
		<div
			className={cn(
				"fixed z-50 flex flex-col bg-card shadow-xl max-h-full",
				side === "left" || side === "right" ? "h-full w-full sm:max-w-lg" : "max-h-[85vh] w-full",
				sideStyles[side],
				className,
			)}
			style={{
				borderColor: "var(--border)",
				background: "var(--card)",
			}}
			role="dialog"
			aria-modal="true"
			tabIndex={-1}
			{...props}
		>
			{children}
		</div>
	);
}

// ── Header ──
interface SheetHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function SheetHeader({ className, children, ...props }: SheetHeaderProps) {
	return (
		<div
			className={cn(
				"flex items-center justify-between border-b px-6 py-4",
				className,
			)}
			style={{ borderColor: "var(--border)" }}
			{...props}
		>
			{children}
		</div>
	);
}

// ── Title ──
interface SheetTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export function SheetTitle({ className, children, ...props }: SheetTitleProps) {
	return (
		<h2 className={cn("text-lg font-semibold", className)} {...props}>
			{children}
		</h2>
	);
}

// ── Description ──
interface SheetDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function SheetDescription({ className, children, ...props }: SheetDescriptionProps) {
	return (
		<p
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		>
			{children}
		</p>
	);
}

// ── Close ──
interface SheetCloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean;
}

export function SheetClose({ className, asChild, children, ...props }: SheetCloseProps) {
	if (asChild) return <>{children}</>;
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/30",
				className,
			)}
			type="button"
			{...props}
		>
			{children}
		</button>
	);
}

// ── Footer ──
interface SheetFooterProps extends HTMLAttributes<HTMLDivElement> {}

export function SheetFooter({ className, children, ...props }: SheetFooterProps) {
	return (
		<div
			className={cn(
				"flex items-center justify-end gap-2 border-t px-6 py-4",
				className,
			)}
			style={{ borderColor: "var(--border)" }}
			{...props}
		>
			{children}
		</div>
	);
}