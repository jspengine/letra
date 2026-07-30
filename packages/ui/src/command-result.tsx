import { cn } from "./utils";

interface CommandResultProps {
	command: string;
	output?: string;
	exitCode?: number;
	className?: string;
}

export function CommandResult({ command, output, exitCode, className }: CommandResultProps) {
	const isError = exitCode !== undefined && exitCode !== 0;

	return (
		<div
			className={cn("rounded-[var(--radius-md)] border-[length:var(--border-thin)] overflow-hidden", className)}
			style={{
				background: "var(--color-bg-sunken)",
				borderColor: isError ? "color-mix(in srgb, var(--color-danger) 30%, transparent)" : "var(--color-border)",
			}}
		>
			<div
				className="flex items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)] border-b"
				style={{
					borderColor: "var(--color-border)",
					background: "var(--color-bg-base)",
				}}
			>
				<span
					className="size-2 rounded-full shrink-0"
					style={{
						background: isError ? "var(--color-danger)" : "var(--color-success)",
					}}
					aria-hidden="true"
				/>
				<span className="text-mono text-xs" style={{ color: isError ? "var(--color-danger)" : "var(--color-primary)" }}>
					$ {command}
				</span>
			</div>
			{output !== undefined && (
				<pre
					className="px-[var(--space-3)] py-[var(--space-2)] text-mono text-xs overflow-x-auto whitespace-pre-wrap"
					style={{
						color: isError ? "var(--color-danger)" : "var(--color-text-primary)",
						maxHeight: "240px",
					}}
				>
					{output}
				</pre>
			)}
		</div>
	);
}
