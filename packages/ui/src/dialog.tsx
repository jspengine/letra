import { type ReactNode, type Ref, useEffect, useRef } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { Input } from "./input";
import { Label } from "./label";
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
		const handler = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			ref={overlayRef}
			className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center animate-fade-in backdrop-blur-sm"
			style={{ background: "var(--overlay)" }}
			onClick={(event) => {
				if (event.target === overlayRef.current) onClose();
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") onClose();
			}}
		>
			<dialog
				ref={contentRef}
				open
				className={cn(
					"border-[length:var(--border-thin)] shadow-xl animate-slide-up",
					variant === "fullscreen"
						? "m-0 flex h-screen max-h-none w-screen max-w-none flex-col overflow-hidden rounded-none"
						: "mx-4 w-full max-w-md rounded-[var(--radius-lg)]",
					className,
				)}
				style={{
					background: "var(--color-bg-surface)",
					borderColor: "var(--color-border)",
					color: "var(--color-text-primary)",
				}}
				aria-label={title}
			>
				{!hideHeader && (
					<div
						className="flex items-center justify-between border-b px-[var(--space-4)] py-[var(--space-3)]"
						style={{ borderColor: "var(--color-border)" }}
					>
						<h2 className="text-h2" style={{ color: "var(--color-text-primary)" }}>
							{title}
						</h2>
						<button
							type="button"
							onClick={onClose}
							className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-bg-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]"
							style={{ color: "var(--color-text-secondary)" }}
							aria-label="Close dialog"
						>
							<Icon name="x" size={16} />
						</button>
					</div>
				)}
				<div
					className={cn(
						variant === "fullscreen"
							? "flex min-h-0 flex-1 flex-col"
							: "px-[var(--space-4)] py-[var(--space-3)]",
						bodyClassName,
					)}
				>
					{children}
				</div>
				{actions && (
					<div
						className="flex justify-end gap-[var(--space-3)] border-t px-[var(--space-4)] py-[var(--space-3)]"
						style={{ borderColor: "var(--color-border)" }}
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
					<Button type="button" variant="secondary" onClick={onClose}>
						{cancelLabel}
					</Button>
					<Button
						type="button"
						variant={variant === "danger" ? "danger" : "primary"}
						onClick={() => {
							onConfirm();
							onClose();
						}}
					>
						{confirmLabel}
					</Button>
				</>
			}
		>
			<p className="text-body" style={{ color: "var(--color-text-secondary)" }}>
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

	const submit = () => {
		const value = inputRef.current?.value.trim();
		if (!value) return;
		onSubmit(value);
		onClose();
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={title}
			actions={
				<>
					<Button type="button" variant="secondary" onClick={onClose}>
						{cancelLabel}
					</Button>
					<Button type="button" onClick={submit}>
						{submitLabel}
					</Button>
				</>
			}
		>
			<Label className="flex flex-col items-start gap-[var(--space-2)]">
				<span
					className="text-caption font-medium"
					style={{ color: "var(--color-text-secondary)" }}
				>
					{label}
				</span>
				<Input
					ref={inputRef}
					type="text"
					placeholder={placeholder}
					onKeyDown={(event) => {
						if (event.key === "Enter") submit();
					}}
				/>
			</Label>
		</Dialog>
	);
}
