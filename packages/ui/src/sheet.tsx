import {
	createContext,
	useContext,
	useEffect,
	useState,
	type HTMLAttributes,
	type ButtonHTMLAttributes,
	useCallback,
} from "react";
import { cn } from "./utils";

interface SheetContextValue {
	open: boolean;
	setOpen: (v: boolean) => void;
}

const SheetContext = createContext<SheetContextValue | null>(null);

// ── Sheet Root ──
interface SheetProps {
	children:
		| React.ReactNode
		| ((props: { open: boolean; setOpen: (v: boolean) => void }) => React.ReactNode);
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function Sheet({ children, open, onOpenChange }: SheetProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = open !== undefined;
	const isOpen = isControlled ? open : internalOpen;

	const setOpen = useCallback(
		(v: boolean) => {
			if (!isControlled) setInternalOpen(v);
			onOpenChange?.(v);
		},
		[isControlled, onOpenChange],
	);

	return (
		<SheetContext.Provider value={{ open: isOpen, setOpen }}>
			{typeof children === "function"
				? (
						children as (props: {
							open: boolean;
							setOpen: (v: boolean) => void;
						}) => React.ReactNode
					)({ open: isOpen, setOpen })
				: children}
		</SheetContext.Provider>
	);
}

// ── Trigger ──
interface SheetTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean;
}

export function SheetTrigger({
	className,
	asChild,
	children,
	onClick,
	...props
}: SheetTriggerProps) {
	const sheet = useContext(SheetContext);
	if (asChild) return <>{children}</>;
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-body font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-bg-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]",
				className,
			)}
			type="button"
			style={{ color: "var(--color-text-primary)" }}
			onClick={(event) => {
				sheet?.setOpen(true);
				onClick?.(event);
			}}
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

export function SheetContent({ className, side = "right", children, ...props }: SheetContentProps) {
	const sheet = useContext(SheetContext);
	useEffect(() => {
		if (!sheet?.open) return;
		const handler = (event: KeyboardEvent) => {
			if (event.key === "Escape") sheet.setOpen(false);
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [sheet]);

	if (sheet && !sheet.open) return null;

	const sideStyles: Record<string, string> = {
		top: "inset-x-0 top-0 border-b",
		bottom: "inset-x-0 bottom-0 border-t",
		left: "inset-y-0 left-0 border-r",
		right: "inset-y-0 right-0 border-l",
	};

	return (
		<div
			className="fixed inset-0 z-50 animate-fade-in backdrop-blur-sm"
			style={{ background: "var(--overlay)" }}
			onClick={() => sheet?.setOpen(false)}
		>
			<div
				className={cn(
					"fixed flex flex-col shadow-xl max-h-full animate-slide-up",
					side === "left" || side === "right"
						? "h-full w-full sm:max-w-lg"
						: "max-h-[85vh] w-full rounded-t-[var(--radius-lg)]",
					sideStyles[side],
					className,
				)}
				style={{
					borderColor: "var(--color-border)",
					background: "var(--color-bg-surface)",
				}}
				role="dialog"
				aria-modal="true"
				tabIndex={-1}
				onClick={(event) => event.stopPropagation()}
				{...props}
			>
				{children}
			</div>
		</div>
	);
}

// ── Header ──
interface SheetHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function SheetHeader({ className, children, ...props }: SheetHeaderProps) {
	return (
		<div
			className={cn(
				"flex items-center justify-between border-b px-[var(--space-6)] py-[var(--space-4)]",
				className,
			)}
			style={{ borderColor: "var(--color-border)" }}
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
		<h2 className={cn("text-h2", className)} {...props}>
			{children}
		</h2>
	);
}

// ── Description ──
interface SheetDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function SheetDescription({ className, children, ...props }: SheetDescriptionProps) {
	return (
		<p className={cn("text-body", className)} style={{ color: "var(--color-text-secondary)" }}>
			{children}
		</p>
	);
}

// ── Close ──
interface SheetCloseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	asChild?: boolean;
}

export function SheetClose({ className, asChild, children, onClick, ...props }: SheetCloseProps) {
	const sheet = useContext(SheetContext);
	if (asChild) return <>{children}</>;
	return (
		<button
			className={cn(
				"inline-flex items-center justify-center rounded-[var(--radius-md)] p-1.5 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-bg-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]",
				className,
			)}
			style={{ color: "var(--color-text-secondary)" }}
			type="button"
			onClick={(event) => {
				sheet?.setOpen(false);
				onClick?.(event);
			}}
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
				"flex items-center justify-end gap-[var(--space-3)] border-t px-[var(--space-6)] py-[var(--space-4)]",
				className,
			)}
			style={{ borderColor: "var(--color-border)" }}
			{...props}
		>
			{children}
		</div>
	);
}
