import { useState } from "react";
import { Button, Icon, Popover, PopoverTrigger, PopoverContent } from "@letra/ui";

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
	if (suggestions.length === 0) return null;

	return (
		<Popover>
		 {({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) => (
				<>
					<PopoverTrigger asChild>
						<Button
							type="button"
							className="relative flex items-center justify-center w-5 h-5 rounded-full hover:opacity-80 transition-opacity"
							style={{ background: "var(--warning)" }}
							aria-label={`${suggestions.length} sugestão(ões)`}
						/>
					</PopoverTrigger>
					{open && (
						<PopoverContent align="end" className="w-80 p-0">
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
										<Button
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
										</Button>
									</div>
								))}
							</div>
							<Button
								type="button"
								onClick={() => {
									onOpenHistory();
									setOpen(false);
								}}
								className="w-full px-3 py-2 text-xs font-medium text-left border-t transition-colors hover:opacity-80"
								style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
							>
								Ver histórico de correções →
							</Button>
						</PopoverContent>
					)}
				</>
			)}
		</Popover>
	);
}
