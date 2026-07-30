import { useState, type ReactNode } from "react";
import { cn } from "./utils";
import { Icon } from "./icon";

interface ErrorBannerProps {
	title?: string;
	children: ReactNode;
	details?: string;
	onRetry?: () => void;
	className?: string;
}

export function ErrorBanner({ title, children, details, onRetry, className }: ErrorBannerProps) {
	const [expanded, setExpanded] = useState(false);

	return (
		<div
			className={cn("rounded-[var(--radius-md)] border-[length:var(--border-thin)] text-body", className)}
			style={{
				background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
				borderColor: "var(--color-danger)",
			}}
			role="alert"
		>
			<div className="flex items-start gap-[var(--space-2)] p-[var(--space-3)]">
				<Icon name="x-circle" width="var(--icon-md)" height="var(--icon-md)" className="shrink-0 mt-0.5" style={{ color: "var(--color-danger)" }} />
				<div className="flex-1 min-w-0" style={{ color: "var(--color-text-primary)" }}>
					{title && <strong className="block font-semibold mb-0.5">{title}</strong>}
					<div>{children}</div>
				</div>
				<div className="flex items-center gap-[var(--space-1)] shrink-0">
					{onRetry && (
						<button
							onClick={onRetry}
							className="text-caption font-medium px-[var(--space-2)] py-[var(--space-1)] rounded transition-colors hover:opacity-80"
							style={{ background: "color-mix(in srgb, var(--color-danger) 15%, transparent)", color: "var(--color-danger)" }}
						>
							Tentar novamente
						</button>
					)}
					{details && (
						<button
							onClick={() => setExpanded(!expanded)}
							className="text-caption px-[var(--space-1)] py-[var(--space-1)] rounded transition-colors hover:opacity-80"
							style={{ color: "var(--color-text-secondary)" }}
							aria-label={expanded ? "Recolher detalhes" : "Expandir detalhes"}
							aria-expanded={expanded}
						>
							<Icon name={expanded ? "chevron-up" : "chevron-down"} width="var(--icon-sm)" height="var(--icon-sm)" />
						</button>
					)}
				</div>
			</div>
			{details && expanded && (
				<div
					className="px-[var(--space-3)] pb-[var(--space-3)] pt-0 text-caption"
					style={{ color: "var(--color-text-secondary)" }}
				>
					<pre
						className="p-[var(--space-2)] rounded whitespace-pre-wrap break-words max-h-48 overflow-y-auto"
						style={{ background: "color-mix(in srgb, var(--color-bg-sunken) 50%, transparent)", fontFamily: "var(--font-code)" }}
					>
						{details}
					</pre>
				</div>
			)}
		</div>
	);
}
