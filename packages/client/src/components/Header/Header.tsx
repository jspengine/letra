import { Badge, Button, Icon } from "@letra/ui";
import DiagnosticsIndicator from "../Diagnostics/DiagnosticsIndicator";

interface Suggestion {
	id: string;
	title: string;
	description: string;
	type: string;
	detector: string;
}

interface Props {
	name: string;
	theme: "light" | "dark";
	onThemeChange: (t: "light" | "dark") => void;
	suggestions?: Suggestion[];
	onApplySuggestion?: (s: Suggestion) => void;
	onOpenHistory?: () => void;
}

export default function Header({
	name,
	theme,
	onThemeChange,
	suggestions = [],
	onApplySuggestion,
	onOpenHistory,
}: Props) {
	return (
		<header
			className="flex items-center justify-between px-4 py-2 border-b"
			style={{
				borderColor: "var(--border)",
				background:
					"linear-gradient(to right, var(--card), color-mix(in oklch, var(--card) 95%, var(--accent) 5%))",
				color: "var(--foreground)",
			}}
		>
			<div className="flex items-center gap-3">
				<h1 className="text-lg font-bold">Letra</h1>
				<span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
					{name}
				</span>
			</div>

			<div className="flex items-center gap-2">
				{suggestions.length > 0 && onApplySuggestion && onOpenHistory && (
					<DiagnosticsIndicator
						suggestions={suggestions}
						onApplyFix={onApplySuggestion}
						onOpenHistory={onOpenHistory}
					/>
				)}

				<button
					type="button"
					onClick={() => onOpenHistory?.()}
					className="p-1.5 rounded hover:opacity-70 transition-opacity"
					style={{ color: "var(--muted-foreground)" }}
					aria-label="Histórico de correções"
				>
					<Icon name="settings" size={16} />
				</button>

				<Button
					variant="ghost"
					size="sm"
					onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
					aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
				>
					<Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
				</Button>
				<Badge variant="success" className="animate-pulse-live">
					live
				</Badge>
			</div>
		</header>
	);
}
