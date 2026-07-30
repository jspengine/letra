import {
	useState,
	useRef,
	useEffect,
	useCallback,
	useContext,
	createContext,
	type HTMLAttributes,
	type ButtonHTMLAttributes,
	type ReactNode,
} from "react";
import { Icon } from "./icon";
import { cn } from "./utils";

interface SelectContextValue {
	value: string;
	setValue: (v: string) => void;
	open: boolean;
	setOpen: (v: boolean) => void;
	selectedValue: string;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext() {
	const ctx = useContext(SelectContext);
	if (!ctx) throw new Error("Select sub-components must be used within <Select>");
	return ctx;
}

interface SelectProps {
	children: ReactNode | ((props: { value: string; setValue: (v: string) => void }) => ReactNode);
	value?: string;
	onValueChange?: (value: string) => void;
	defaultValue?: string;
}

export function Select({ children, value, onValueChange, defaultValue }: SelectProps) {
	const [internalValue, setInternalValue] = useState(defaultValue ?? "");
	const [open, setOpen] = useState(false);
	const isControlled = value !== undefined;
	const selectedValue = isControlled ? value : internalValue;
	const ref = useRef<HTMLDivElement>(null);

	const setValue = useCallback(
		(v: string) => {
			if (!isControlled) setInternalValue(v);
			onValueChange?.(v);
			setOpen(false);
		},
		[isControlled, onValueChange],
	);

	useEffect(() => {
		if (!open) return;
		function handleClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
	}, [open]);

	return (
		<SelectContext.Provider value={{ value: selectedValue, setValue, open, setOpen, selectedValue }}>
			<div ref={ref} className="relative">
				{typeof children === "function"
					? (children as (props: { value: string; setValue: (v: string) => void }) => ReactNode)({ value: selectedValue, setValue })
					: children}
			</div>
		</SelectContext.Provider>
	);
}

interface SelectTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	placeholder?: string;
}

export function SelectTrigger({
	className,
	children,
	placeholder,
	...props
}: SelectTriggerProps) {
	const { open, setOpen } = useSelectContext();
	return (
		<button
			className={cn(
				"flex h-9 w-full items-center justify-between whitespace-nowrap rounded-[var(--radius-sm)] border-[length:var(--border-thin)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-sm shadow-sm transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-bg-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			style={{ borderColor: "var(--color-border)" }}
			type="button"
			onClick={() => setOpen(!open)}
			{...props}
		>
			{children ?? (placeholder ? <span style={{ color: "var(--color-text-secondary)" }}>{placeholder}</span> : null)}
			<Icon name="chevron-down" size={16} className={cn("opacity-50 transition-transform", open && "rotate-180")} />
		</button>
	);
}

interface SelectContentProps extends HTMLAttributes<HTMLDivElement> {
	position?: "item-aligned" | "popper";
}

export function SelectContent({
	className,
	position = "popper",
	children,
	...props
}: SelectContentProps) {
	const { open } = useSelectContext();
	if (!open) return null;
	return (
		<div
			className={cn(
				"absolute z-50 min-w-[8rem] overflow-hidden rounded-[var(--radius-xs)] border-[length:var(--border-thin)] bg-card p-[var(--space-2)] shadow-md mt-1 w-full",
				className,
			)}
			style={{ borderColor: "var(--color-border)", background: "var(--color-bg-surface)" }}
			{...props}
		>
			{children}
		</div>
	);
}

interface SelectItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	value: string;
}

export function SelectItem({
	className,
	value,
	children,
	...props
}: SelectItemProps) {
	const { setValue, selectedValue } = useSelectContext();
	const isSelected = selectedValue === value;
	return (
		<button
			className={cn(
						"relative flex w-full cursor-default select-none items-center rounded-[var(--radius-xs)] px-[var(--space-2)] py-[var(--space-1)] text-sm outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-bg-sunken)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
						isSelected && "bg-[var(--color-primary)]/10",
						className,
					)}
					style={{ color: isSelected ? "var(--color-primary)" : "var(--color-text-primary)" }}
			type="button"
			role="option"
			aria-selected={isSelected}
			onClick={() => setValue(value)}
			{...props}
		>
			{children}
		</button>
	);
}

interface SelectValueProps extends HTMLAttributes<HTMLSpanElement> {
	placeholder?: string;
}

export function SelectValue({ className, placeholder, ...props }: SelectValueProps) {
	return (
		<span className={cn("text-sm", className)} {...props}>
			{props.children ?? placeholder ?? ""}
		</span>
	);
}
