import type { GateDecision } from "@letra/types";
import { Button, Icon, PromptDialog, useToast } from "@letra/ui";
import { useState } from "react";

interface Props {
	itemId: string;
	onDecided?: () => void;
}

type ReasonedDecision = Exclude<GateDecision, "approve">;

const SUCCESS_MESSAGE: Record<GateDecision, string> = {
	approve: "Decisão aprovada e registrada.",
	"request-changes": "Alterações solicitadas e registradas.",
	reject: "Rejeição registrada.",
};

export default function GateDecisionActions({ itemId, onDecided }: Props) {
	const { toast } = useToast();
	const [promptDecision, setPromptDecision] = useState<ReasonedDecision | null>(null);
	const [pending, setPending] = useState<GateDecision | null>(null);

	async function decide(decision: GateDecision, reason?: string) {
		setPending(decision);
		try {
			const response = await fetch(`/api/items/${itemId}/gate-decisions`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ decision, reason }),
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(result.error || "Não foi possível registrar a decisão.");
			}
			toast(SUCCESS_MESSAGE[decision], "success");
			onDecided?.();
		} catch (error) {
			toast(
				error instanceof Error ? error.message : "Não foi possível registrar a decisão.",
				"error",
			);
		} finally {
			setPending(null);
		}
	}

	return (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant="primary"
					size="sm"
					disabled={pending !== null}
					onClick={() => void decide("approve")}
				>
					<Icon name="check" size={14} />
					{pending === "approve" ? "Registrando..." : "Aprovar"}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={pending !== null}
					onClick={() => setPromptDecision("request-changes")}
				>
					<Icon name="edit" size={14} />
					Solicitar alterações
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={pending !== null}
					onClick={() => setPromptDecision("reject")}
				>
					<Icon name="x" size={14} />
					Rejeitar
				</Button>
			</div>

			<PromptDialog
				open={promptDecision !== null}
				onClose={() => setPromptDecision(null)}
				onSubmit={(reason) => {
					if (promptDecision) void decide(promptDecision, reason);
				}}
				title={promptDecision === "reject" ? "Rejeitar item" : "Solicitar alterações"}
				label="Motivo obrigatório"
				placeholder="Explique o direcionamento para manter a decisão auditável"
				submitLabel={promptDecision === "reject" ? "Rejeitar" : "Solicitar alterações"}
			/>
		</>
	);
}
