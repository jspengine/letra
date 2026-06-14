import { useState, useRef, useEffect } from "react";
import { Icon } from "@letra/ui";

interface Suggestion {
	id: string;
	title: string;
	description: string;
	type: string;
	detector: string;
}

interface Fix {
	id: string;
	title: string;
	description: string;
	snapshotId: string;
}

interface Props {
	suggestions: Suggestion[];
	onApplyFix: (suggestion: Suggestion) => void;
	onOpenHistory: () => void;
}

export default function DiagnosticsIndicator({ suggestions, onApplyFix, onOpenHistory }: Props) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		}
		if (open) document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [open]);

	if (suggestions.length === 0) return null;

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="relative flex items-center justify-center w-5 h-5 rounded-full hover:opacity-80 transition-opacity"
				style={{ background: "var(--warning)" }}
				aria-label={`${suggestions.length} sugestão(ões)`}
			/>

			{open && (
				<div
					className="absolute right-0 top-8 w-80 rounded-lg shadow-xl border z-50 overflow-hidden"
					style={{
						background: "var(--card)",
						borderColor: "var(--border)",
						color: "var(--foreground)",
					}}
				>
					<div
						className="px-3 py-2 text-xs font-semibold border-b"
						style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
					>
						Sugestões ({suggestions.length})
					</div>
					<div className="max-h-80 overflow-y-auto">
						{suggestions.map((s) => (
							<div
								key={s.id}
								className="px-3 py-2 border-b text-sm flex items-start gap-2"
								style={{ borderColor: "var(--border)" }}
							>
								<span className="mt-0.5 shrink-0">💡</span>
								<div className="flex-1 min-w-0">
									<div className="font-medium truncate">{s.title}</div>
									<div
										className="text-xs mt-0.5"
										style={{ color: "var(--muted-foreground)" }}
									>
										{s.description}
									</div>
								</div>
								<button
									type="button"
									onClick={() => {
										onApplyFix(s);
										setOpen(false);
									}}
									className="shrink-0 text-xs px-2 py-1 rounded font-medium transition-colors"
									style={{
										background: "var(--primary)",
										color: "var(--primary-foreground)",
									}}
								>
									Ok
								</button>
							</div>
						))}
					</div>
					<button
						type="button"
						onClick={() => {
							onOpenHistory();
							setOpen(false);
						}}
						className="w-full px-3 py-2 text-xs font-medium text-left border-t transition-colors hover:opacity-80"
						style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
					>
						Ver histórico de correções →
					</button>
				</div>
			)}
		</div>
	);
}
