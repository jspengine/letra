import { Button, Icon, Popover, PopoverContent, PopoverTrigger } from "@letra/ui";

interface Suggestion {
	id: string;
	title: string;
	description: string;
	type: string;
	detector: string;
}

interface Props {
	suggestions: Suggestion[];
	onApplyFix: (suggestion: Suggestion) => void;
	onOpenHistory?: () => void;
}

export default function DiagnosticsIndicator({ suggestions, onApplyFix, onOpenHistory }: Props) {
	if (suggestions.length === 0) return null;

	return (
		<Popover>
			{({ open, setOpen }: { open: boolean; setOpen: (value: boolean) => void }) => (
				<>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="app-status-pill app-status-pill--action px-[var(--space-3)]"
							aria-label={`Revisar ${suggestions.length} ${suggestions.length === 1 ? "correcao sugerida pelo diagnostico" : "correcoes sugeridas pelo diagnostico"}`}
							title="Correcoes sugeridas pelo diagnostico"
						>
							<Icon name="sparkles" size={16} />
							<span>
								{suggestions.length} {suggestions.length === 1 ? "correcao" : "correcoes"}
							</span>
						</Button>
					</PopoverTrigger>
					{open ? (
						<PopoverContent align="end" className="w-80 p-0">
							<div
								className="grid gap-1 border-b px-3 py-2 text-xs"
								style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
							>
								<strong className="text-sm text-[var(--color-text-primary)]">Correcoes sugeridas pelo diagnostico</strong>
								<span>Use quando quiser aplicar ajustes automaticos detectados pelo Letra.</span>
							</div>
							<div className="max-h-80 overflow-y-auto">
								{suggestions.map((suggestion) => (
									<div
										key={suggestion.id}
										className="flex items-start gap-2 border-b px-3 py-2 text-sm"
										style={{ borderColor: "var(--color-border)" }}
									>
										<Icon name="sparkles" size={14} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
										<div className="min-w-0 flex-1">
											<div className="truncate font-medium">{suggestion.title}</div>
											<div
												className="mt-0.5 text-xs"
												style={{ color: "var(--color-text-secondary)" }}
											>
												{suggestion.description}
											</div>
										</div>
										<Button
											type="button"
											onClick={() => {
												onApplyFix(suggestion);
												setOpen(false);
											}}
											className="shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors"
											style={{
												background: "var(--color-primary)",
												color: "var(--color-on-accent)",
											}}
										>
											Ok
										</Button>
									</div>
								))}
							</div>
							{onOpenHistory ? (
								<Button
									type="button"
									onClick={() => {
										onOpenHistory();
										setOpen(false);
									}}
									className="w-full border-t px-3 py-2 text-left text-xs font-medium transition-colors hover:opacity-80"
									style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
								>
									Abrir log de correcoes aplicadas
								</Button>
							) : null}
						</PopoverContent>
					) : null}
				</>
			)}
		</Popover>
	);
}
