import { Card, CardContent, Button, Icon } from "@letra/ui";
import { cn } from "../../lib/utils";

export type GateStatus = "waiting" | "available" | "approved" | "changes-requested" | "rejected" | "expired";

export interface GateData {
	id: string;
	feature: string;
	stage: string;
	agent: string;
	status: GateStatus;
	since: string; // ISO timestamp
	specUrl?: string;
}

interface Props {
	gate: GateData;
	onApprove?: (id: string) => void;
	onChanges?: (id: string) => void;
	onReject?: (id: string) => void;
}

const GATE_LABELS: Record<GateStatus, string> = {
	waiting: "Aguardando",
	available: "Aprovação Necessária",
	approved: "Aprovado",
	"changes-requested": "Alterações Solicitadas",
	rejected: "Rejeitado",
	expired: "Expirado",
};

const GATE_COLORS: Record<GateStatus, string> = {
	waiting: "var(--color-warning)",
	available: "var(--color-success)",
	approved: "var(--color-success)",
	"changes-requested": "var(--color-warning)",
	rejected: "var(--color-danger)",
	expired: "var(--color-text-secondary)",
};

function timeSince(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "agora";
	if (mins < 60) return `${mins}min`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	return `${days}d`;
}

export default function GateCard({ gate, onApprove, onChanges, onReject }: Props) {
	const isActionable = gate.status === "available";
	const isUrgent = isActionable && (Date.now() - new Date(gate.since).getTime()) > 300000; // >5min

	return (
		<Card
			className={cn(
				"border-l-4 transition-all duration-200",
				isActionable && "hover:shadow-md",
				isUrgent && "animate-pulse-gate-urgent",
			)}
			style={{
				borderLeftColor: GATE_COLORS[gate.status],
			}}
		>
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<span
								className="text-caption font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
								style={{
									background: `${GATE_COLORS[gate.status]}20`,
									color: GATE_COLORS[gate.status],
								}}
							>
								{GATE_LABELS[gate.status]}
							</span>
							<span className="text-caption" style={{ color: "var(--color-text-secondary)" }}>
								há {timeSince(gate.since)}
							</span>
						</div>
						<h4 className="text-sm font-semibold truncate">{gate.feature}</h4>
						<p className="text-xs mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
							{gate.stage} · {gate.agent}
						</p>
					</div>
					{isActionable && (
						<div className="flex items-center gap-1.5 shrink-0">
							<Button variant="ghost" size="sm" onClick={() => onChanges?.(gate.id)}>
								Alterar
							</Button>
							<Button variant="ghost" size="sm" onClick={() => onReject?.(gate.id)}>
								<Icon name="x" size={14} />
								Rejeitar
							</Button>
							<Button variant="primary" size="sm" onClick={() => onApprove?.(gate.id)}>
								<Icon name="check" size={14} />
								Aprovar
							</Button>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export function GatePendingList({ gates, onApprove, onChanges, onReject }: {
	gates: GateData[];
	onApprove?: (id: string) => void;
	onChanges?: (id: string) => void;
	onReject?: (id: string) => void;
}) {
	const actionable = gates.filter((g) => g.status === "available");
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 mb-1">
				<Icon name="shield" size={16} style={{ color: actionable.length > 0 ? "var(--color-success)" : "var(--color-text-secondary)" }} />
				<span className="text-sm font-semibold">
					{actionable.length > 0 ? `Gate${actionable.length > 1 ? "s" : ""} Pendente${actionable.length > 1 ? "s" : ""}` : "Gates"}
				</span>
				{actionable.length > 0 && (
					<span
						className="text-caption font-bold px-1.5 py-0.5 rounded-full"
						style={{ background: "var(--color-success)", color: "var(--color-text-primary)" }}
					>
						{actionable.length}
					</span>
				)}
			</div>
			{gates.length === 0 ? (
				<p className="text-sm py-4 text-center" style={{ color: "var(--color-text-secondary)" }}>
					Nenhum gate pendente
				</p>
			) : (
				gates.map((g) => (
					<GateCard
						key={g.id}
						gate={g}
						onApprove={onApprove}
						onChanges={onChanges}
						onReject={onReject}
					/>
				))
			)}
		</div>
	);
}
