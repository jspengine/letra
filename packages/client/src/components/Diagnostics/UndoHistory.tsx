import { useState, useEffect } from "react";
import { Icon } from "@letra/ui";

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

	async function handleUndo(snapshotId: string) {
		try {
			const res = await fetch(`/api/diagnostics/undo/${snapshotId}`, { method: "POST" });
			const data = await res.json();
			if (data.ok) {
				loadSnapshots();
				window.location.reload();
			} else {
				alert("Falha ao desfazer: snapshot não encontrado");
			}
		} catch {
			alert("Erro ao desfazer correção");
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
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-16"
			style={{ background: "rgba(0,0,0,0.4)" }}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="w-full max-w-lg rounded-xl border shadow-xl overflow-hidden max-h-[70vh] flex flex-col"
				style={{
					background: "var(--card)",
					borderColor: "var(--border)",
					color: "var(--foreground)",
				}}
			>
				<div
					className="flex items-center justify-between px-4 py-3 border-b"
					style={{ borderColor: "var(--border)" }}
				>
					<h2 className="text-base font-semibold">Histórico de Correções</h2>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded hover:opacity-70"
					>
						<Icon name="x" size={16} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-4">
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
										: snap.diagnosticId.startsWith("dead-icons")
											? "\uD83C\uDFA8"
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
											<button
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
											</button>
										</div>
									);
								})}
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
