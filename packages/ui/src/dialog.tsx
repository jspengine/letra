import { type ReactNode, type Ref, useEffect, useRef } from "react";
import { cn } from "./utils";

interface DialogProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	actions?: ReactNode;
	variant?: "default" | "fullscreen";
	hideHeader?: boolean;
	className?: string;
	bodyClassName?: string;
	contentRef?: Ref<HTMLDialogElement>;
}

export function Dialog({
	open,
	onClose,
	title,
	children,
	actions,
	variant = "default",
	hideHeader = false,
	className,
	bodyClassName,
	contentRef,
}: DialogProps) {
	const overlayRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			ref={overlayRef}
			className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
			style={{ background: "var(--overlay)" }}
			onClick={(e) => {
				if (e.target === overlayRef.current) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
		>
			<dialog
				ref={contentRef}
				open
				className={cn(
					"border shadow-lg",
					variant === "fullscreen"
						? "m-0 flex h-screen max-h-none w-screen max-w-none flex-col overflow-hidden rounded-none"
						: "mx-4 w-full max-w-md rounded-xl",
					className,
				)}
				style={{
					background: "var(--card)",
					borderColor: "var(--border)",
					color: "var(--foreground)",
				}}
				aria-label={title}
			>
				{!hideHeader && (
					<div
						className="flex items-center justify-between px-4 py-3 border-b"
						style={{ borderColor: "var(--border)" }}
					>
						<h2 className="text-sm font-semibold">{title}</h2>
						<button
							type="button"
							onClick={onClose}
							className="text-sm px-2 py-1 rounded hover:bg-muted/50 transition-colors"
							style={{ color: "var(--muted-foreground)" }}
							aria-label="Fechar"
						>
							✕
						</button>
					</div>
				)}
				<div
					className={cn(
						variant === "fullscreen" ? "flex min-h-0 flex-1 flex-col" : "px-4 py-3",
						bodyClassName,
					)}
				>
					{children}
				</div>
				{actions && (
					<div
						className="flex justify-end gap-2 px-4 py-3 border-t"
						style={{ borderColor: "var(--border)" }}
					>
						{actions}
					</div>
				)}
			</dialog>
		</div>
	);
}

interface ConfirmDialogProps {
	open: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	variant?: "default" | "danger";
}

export function ConfirmDialog({
	open,
	onClose,
	onConfirm,
	title,
	message,
	confirmLabel = "Confirmar",
	cancelLabel = "Cancelar",
	variant = "default",
}: ConfirmDialogProps) {
	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={title}
			actions={
				<>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-border bg-transparent hover:bg-muted text-foreground cursor-pointer"
					>
						{cancelLabel}
					</button>
					<button
						type="button"
						onClick={() => {
							onConfirm();
							onClose();
						}}
						className={cn(
							"inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-transparent cursor-pointer",
						)}
						style={{
							background: variant === "danger" ? "var(--error)" : "var(--primary)",
							color: "var(--primary-foreground)",
						}}
					>
						{confirmLabel}
					</button>
				</>
			}
		>
			<p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
				{message}
			</p>
		</Dialog>
	);
}

interface PromptDialogProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (value: string) => void;
	title: string;
	label: string;
	placeholder?: string;
	submitLabel?: string;
	cancelLabel?: string;
}

export function PromptDialog({
	open,
	onClose,
	onSubmit,
	title,
	label,
	placeholder,
	submitLabel = "Criar",
	cancelLabel = "Cancelar",
}: PromptDialogProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open && inputRef.current) inputRef.current.focus();
	}, [open]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={title}
			actions={
				<>
					<button
						type="button"
						onClick={onClose}
						className="inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-border bg-transparent hover:bg-muted text-foreground cursor-pointer"
					>
						{cancelLabel}
					</button>
					<button
						type="button"
						onClick={() => {
							const val = inputRef.current?.value.trim();
							if (val) {
								onSubmit(val);
								onClose();
							}
						}}
						className="inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-transparent cursor-pointer"
						style={{
							background: "var(--primary)",
							color: "var(--primary-foreground)",
						}}
					>
						{submitLabel}
					</button>
				</>
			}
		>
			<label className="flex flex-col gap-1.5">
				<span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
					{label}
				</span>
				<input
					ref={inputRef}
					type="text"
					placeholder={placeholder}
					className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
					style={{
						borderColor: "var(--border)",
						background: "var(--background)",
						color: "var(--foreground)",
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							const val = inputRef.current?.value.trim();
							if (val) {
								onSubmit(val);
								onClose();
							}
						}
					}}
				/>
			</label>
		</Dialog>
	);
}
