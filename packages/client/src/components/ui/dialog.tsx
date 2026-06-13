import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DialogProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	actions?: ReactNode;
}

export function Dialog({ open, onClose, title, children, actions }: DialogProps) {
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
			className="fixed inset-0 z-50 flex items-center justify-center"
			style={{ background: "var(--overlay)" }}
			onClick={(e) => {
				if (e.target === overlayRef.current) onClose();
			}}
		>
			<div
				className="w-full max-w-md mx-4 rounded-xl border shadow-lg animate-fade-in"
				style={{ background: "var(--card)", borderColor: "var(--border)" }}
				role="dialog"
				aria-modal="true"
				aria-label={title}
			>
				<div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
					<h2 className="text-sm font-semibold">{title}</h2>
					<button
						onClick={onClose}
						className="text-sm px-2 py-1 rounded hover:bg-muted/50 transition-colors"
						style={{ color: "var(--muted-foreground)" }}
						aria-label="Fechar"
					>
						✕
					</button>
				</div>
				<div className="px-4 py-3">
					{children}
				</div>
				{actions && (
					<div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
						{actions}
					</div>
				)}
			</div>
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
						onClick={onClose}
						className={cn(
							"inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-border bg-transparent hover:bg-muted text-foreground cursor-pointer",
						)}
					>
						{cancelLabel}
					</button>
					<button
						onClick={() => { onConfirm(); onClose(); }}
						className={cn(
							"inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-transparent cursor-pointer",
							variant === "danger"
								? "text-error-foreground"
								: "text-primary-foreground",
						)}
						style={{
							background: variant === "danger" ? "var(--error)" : "var(--primary)",
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
		if (open && inputRef.current) {
			inputRef.current.focus();
		}
	}, [open]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={title}
			actions={
				<>
					<button
						onClick={onClose}
						className={cn(
							"inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-border bg-transparent hover:bg-muted text-foreground cursor-pointer",
						)}
					>
						{cancelLabel}
					</button>
					<button
						onClick={() => {
							const val = inputRef.current?.value.trim();
							if (val) { onSubmit(val); onClose(); }
						}}
						className={cn(
							"inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm px-4 py-2 rounded-lg border border-transparent text-primary-foreground cursor-pointer",
						)}
						style={{ background: "var(--primary)" }}
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
							if (val) { onSubmit(val); onClose(); }
						}
					}}
				/>
			</label>
		</Dialog>
	);
}
