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
				"flex h-9 w-full items-center justify-between whitespace-nowrap rounded-lg border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			style={{ borderColor: "var(--border)" }}
			type="button"
			onClick={() => setOpen(!open)}
			{...props}
		>
			{children ?? (placeholder ? <span className="text-muted-foreground">{placeholder}</span> : null)}
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className={cn("opacity-50 transition-transform", open && "rotate-180")}
			>
				<path
					d="M4 6 L8 10 L12 6"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
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
				"absolute z-50 min-w-[8rem] overflow-hidden rounded-lg border bg-card p-1 shadow-md mt-1 w-full",
				className,
			)}
			style={{ borderColor: "var(--border)", background: "var(--card)" }}
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
				"relative flex w-full cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-muted focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				isSelected && "bg-primary/10 text-primary",
				className,
			)}
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
