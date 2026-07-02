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
			className={cn("rounded-lg border text-sm", className)}
			style={{
				background: "color-mix(in srgb, var(--error) 10%, transparent)",
				borderColor: "var(--error)",
			}}
			role="alert"
		>
			<div className="flex items-start gap-2.5 p-3">
				<Icon name="x-circle" size={16} className="shrink-0 mt-0.5" style={{ color: "var(--error)" }} />
				<div className="flex-1 min-w-0" style={{ color: "var(--foreground)" }}>
					{title && <strong className="block font-semibold mb-0.5">{title}</strong>}
					<div>{children}</div>
				</div>
				<div className="flex items-center gap-1 shrink-0">
					{onRetry && (
						<button
							onClick={onRetry}
							className="text-xs font-medium px-2 py-1 rounded transition-colors hover:opacity-80"
							style={{ background: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)" }}
						>
							Tentar novamente
						</button>
					)}
					{details && (
						<button
							onClick={() => setExpanded(!expanded)}
							className="text-xs px-1.5 py-1 rounded transition-colors hover:opacity-80"
							style={{ color: "var(--text-secondary)" }}
							aria-label={expanded ? "Recolher detalhes" : "Expandir detalhes"}
							aria-expanded={expanded}
						>
							<Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} />
						</button>
					)}
				</div>
			</div>
			{details && expanded && (
				<div
					className="px-3 pb-3 pt-0 text-xs"
					style={{ color: "var(--text-secondary)" }}
				>
					<pre
						className="p-2 rounded whitespace-pre-wrap break-words max-h-48 overflow-y-auto"
						style={{ background: "color-mix(in srgb, var(--surface-1) 50%, transparent)", fontFamily: "var(--font-code)" }}
					>
						{details}
					</pre>
				</div>
			)}
		</div>
	);
}
