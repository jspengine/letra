import { useState, useRef, useEffect, type HTMLAttributes, type ButtonHTMLAttributes } from "react";
import { cn } from "./utils";

interface PopoverProps {
	children: React.ReactNode | ((props: { open: boolean; setOpen: (v: boolean) => void }) => React.ReactNode);
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function Popover({ children, open, onOpenChange }: PopoverProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = open !== undefined;
	const isOpen = isControlled ? open : internalOpen;
	const ref = useRef<HTMLDivElement>(null);

	const setOpen = (v: boolean) => {
		if (!isControlled) setInternalOpen(v);
		onOpenChange?.(v);
	};

	useEffect(() => {
		if (!isOpen) return;
		function handleClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		function handleEscape(e: globalThis.KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen]);

	return (
		<div ref={ref} className="relative inline-block">
			{/* @ts-ignore */}
			{typeof children === "function" ? children({ open: isOpen, setOpen }) : children}
		</div>
	);
}

interface PopoverTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean;
}

export function PopoverTrigger({ className, asChild, children, ...props }: PopoverTriggerProps) {
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

interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
	align?: "start" | "center" | "end";
	sideOffset?: number;
}

export function PopoverContent({
	className,
	align = "center",
	sideOffset = 4,
	children,
	...props
}: PopoverContentProps) {
	const alignStyles: Record<string, string> = {
		start: "left-0",
		center: "left-1/2 -translate-x-1/2",
		end: "right-0",
	};

	return (
		<div
			className={cn(
				"absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-lg border bg-card p-4 shadow-md",
				alignStyles[align],
				className,
			)}
			style={{ top: `calc(100% + ${sideOffset}px)`, borderColor: "var(--border)", background: "var(--card)" }}
			{...props}
		>
			{children}
		</div>
	);
}