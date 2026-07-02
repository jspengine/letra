import { useState, useEffect } from "react";
import { Dialog, Button, Icon, useToast } from "@letra/ui";

interface Snapshot {
	id: string;
	timestamp: string;
	diagnosticId: string;
	diagnosticTitle: string;
	files: { path: string; before: string; after: string }[];
}

interface UndoHistoryProps {
	visible: boolean;
	onClose: () => void;
}

export default function UndoHistory({ visible, onClose }: UndoHistoryProps) {
	const { toastWithOptions } = useToast();
	const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
	const [loading, setLoading] = useState(true);

	function loadSnapshots() {
		setLoading(true);
		fetch("/api/diagnostics/snapshots")
			.then((r) => r.json())
			.then((data) => {
				setSnapshots(data.snapshots || []);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}

	useEffect(() => {
		if (visible) loadSnapshots();
	}, [visible]);

	async function handleRedo(snapshotId: string) {
		try {
			const res = await fetch(`/api/diagnostics/redo/${snapshotId}`, { method: "POST" });
			const data = await res.json();
			if (data.ok) {
				loadSnapshots();
				toastWithOptions("Correção reaplicada", { type: "success", duration: 3000 });
			} else {
				toastWithOptions("Expirou — o snapshot foi limpo pelo TTL", { type: "error", duration: 5000 });
			}
		} catch {
			toastWithOptions("Erro ao refazer correção", { type: "error", duration: 3000 });
		}
	}

	async function handleUndo(snapshotId: string) {
		try {
			const res = await fetch(`/api/diagnostics/undo/${snapshotId}`, { method: "POST" });
			const data = await res.json();
			if (data.ok) {
				loadSnapshots();
				toastWithOptions("Correção desfeita", {
					type: "success",
					duration: 10000,
					action: { label: "Refazer", onClick: () => handleRedo(snapshotId) },
				});
			} else {
				toastWithOptions("Expirou — o snapshot foi limpo pelo TTL", { type: "error", duration: 5000 });
			}
		} catch {
			toastWithOptions("Erro ao desfazer correção", { type: "error", duration: 3000 });
		}
	}

	if (!visible) return null;

	function groupByDate(items: Snapshot[]): Record<string, Snapshot[]> {
		const groups: Record<string, Snapshot[]> = {};
		const today = new Date().toDateString();
		const yesterday = new Date(Date.now() - 86400000).toDateString();
		for (const item of items) {
			const d = new Date(item.timestamp);
			const key =
				d.toDateString() === today
					? "Hoje"
					: d.toDateString() === yesterday
						? "Ontem"
						: d.toLocaleDateString();
			if (!groups[key]) groups[key] = [];
			groups[key].push(item);
		}
		return groups;
	}

	const groups = groupByDate(snapshots);

	return (
		<Dialog open={visible} onClose={onClose} title="Histórico de Correções">
			<div className="flex-1 overflow-y-auto max-h-[50vh]">
				{loading ? (
					<div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
						Carregando...
					</div>
				) : snapshots.length === 0 ? (
					<div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
						Nenhuma correção automática registrada ainda.
					</div>
				) : (
					Object.entries(groups).map(([date, items]) => (
						<div key={date} className="mb-4">
							<div
								className="text-xs font-semibold mb-2"
								style={{ color: "var(--muted-foreground)" }}
							>
								{date}
							</div>
							{items.map((snap) => {
								const icon = snap.diagnosticId.startsWith("missing-dir")
									? "\uD83D\uDCC1"
									: "\uD83D\uDCDD";
								return (
									<div
										key={snap.id}
										className="flex items-start gap-2 py-2 border-b text-sm"
										style={{ borderColor: "var(--border)" }}
									>
										<span>{icon}</span>
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">
												{snap.diagnosticTitle}
											</div>
											<div
												className="text-xs"
												style={{ color: "var(--muted-foreground)" }}
											>
												{snap.files.map((f) => f.path).join(", ")}
											</div>
										</div>
										<Button
											type="button"
											onClick={() => handleUndo(snap.id)}
											className="shrink-0 text-xs px-2 py-1 rounded font-medium transition-colors"
											style={{
												background:
													"color-mix(in oklch, var(--error) 15%, transparent)",
												color: "var(--error)",
											}}
										>
											Desfazer
										</Button>
									</div>
								);
							})}
						</div>
					))
				)}
			</div>
		</Dialog>
	);
}
