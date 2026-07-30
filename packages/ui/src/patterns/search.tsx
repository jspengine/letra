import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "../icon";
import { cn } from "../utils";

interface SearchProps {
	placeholder?: string;
	debounceMs?: number;
	onChange?: (value: string) => void;
	className?: string;
}

export function Search({ placeholder = "Search...", debounceMs = 300, onChange, className }: SearchProps) {
	const [value, setValue] = useState("");
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	function handleChange(next: string) {
		setValue(next);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			onChange?.(next);
		}, debounceMs);
	}

	function clear() {
		setValue("");
		onChange?.("");
		inputRef.current?.focus();
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Escape") clear();
	}

	return (
		<div className={cn("flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border-[length:var(--border-thin)] bg-[var(--color-bg-surface)] px-[var(--space-3)] py-[var(--space-2)]", className)} style={{ borderColor: "var(--color-border)" }}>
			<Icon name="search" size={18} style={{ color: "var(--color-text-secondary)" }} />
			<input
				ref={inputRef}
				value={value}
				placeholder={placeholder}
				onChange={(event) => handleChange(event.target.value)}
				onKeyDown={handleKeyDown}
				className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-disabled)]"
				style={{ color: "var(--color-text-primary)" }}
			/>
			{value && (
				<button
					type="button"
					onClick={clear}
					className="rounded-[var(--radius-sm)] p-1 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-bg-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] cursor-pointer"
					aria-label="Clear search"
				>
					<Icon name="x" size={14} style={{ color: "var(--color-text-secondary)" }} />
				</button>
			)}
		</div>
	);
}
