import {
	createContext,
	useContext,
	useState,
	type ButtonHTMLAttributes,
	type HTMLAttributes,
	type InputHTMLAttributes,
} from "react";
import { cn } from "./utils";

interface CommandState {
	query: string;
	setQuery: (query: string) => void;
}

const CommandContext = createContext<CommandState | null>(null);

function useCommand() {
	return useContext(CommandContext);
}

function Command({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
	const [query, setQuery] = useState("");
	return (
		<CommandContext.Provider value={{ query, setQuery }}>
			<div
				data-slot="command"
				className={cn("flex w-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-card text-card-foreground", className)}
				{...props}
			>
				{children}
			</div>
		</CommandContext.Provider>
	);
}

function CommandInput({ className, onChange, ...props }: InputHTMLAttributes<HTMLInputElement>) {
	const command = useCommand();
	return (
		<input
			data-slot="command-input"
			className={cn(
				"h-11 w-full border-b bg-transparent px-[var(--space-3)] text-sm outline-none placeholder:text-muted-foreground rounded-[var(--radius-md)]",
				className,
			)}
			value={command?.query ?? props.value}
			onChange={(event) => {
				command?.setQuery(event.target.value);
				onChange?.(event);
			}}
			{...props}
		/>
	);
}

function CommandList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			data-slot="command-list"
			role="listbox"
			className={cn("max-h-72 overflow-y-auto overflow-x-hidden p-[var(--space-2)]", className)}
			{...props}
		/>
	);
}

function CommandEmpty({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div data-slot="command-empty" className={cn("py-[var(--space-5)] text-center text-sm text-muted-foreground rounded-[var(--radius-md)]", className)} {...props} />;
}

function CommandGroup({
	className,
	heading,
	...props
}: HTMLAttributes<HTMLDivElement> & { heading?: string }) {
	return (
		<div
			data-slot="command-group"
			role="group"
			aria-label={heading}
			className={cn("overflow-hidden p-[var(--space-2)]", className)}
			{...props}
		/>
	);
}

function CommandItem({
	className,
	value,
	onSelect,
	onClick,
	children,
	...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	value?: string;
	onSelect?: (value: string) => void;
}) {
	const command = useCommand();
	const normalizedValue = value ?? (typeof children === "string" ? children : "");
	const hidden = !!command?.query && !normalizedValue.toLowerCase().includes(command.query.toLowerCase());
	if (hidden) return null;
	return (
		<button
			type="button"
			data-slot="command-item"
			role="option"
			className={cn(
				"flex w-full cursor-default items-center rounded-[var(--radius-md)] px-[var(--space-2)] py-[var(--space-1)] text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-50",
				className,
			)}
			onClick={(event) => {
				onSelect?.(normalizedValue);
				onClick?.(event);
			}}
			{...props}
		>
			{children}
		</button>
	);
}

function CommandSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div data-slot="command-separator" role="separator" className={cn("-mx-1 h-px bg-border", className)} {...props} />;
}

function CommandShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
	return <span data-slot="command-shortcut" className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
}

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut };
