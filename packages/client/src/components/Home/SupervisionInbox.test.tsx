import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SupervisionInbox from "./SupervisionInbox";

describe("SupervisionInbox", () => {
	it("prioritizes a pending human decision and explains its safe consequence", async () => {
		const user = userEvent.setup();
		const onReviewDecision = vi.fn();

		render(
			<SupervisionInbox
				decisions={[
					{
						itemId: "ITEM-9",
						title: "Aprovar contrato publico",
						stage: "Review",
						actor: "Reviewer",
						since: "ha 2h",
					},
				]}
				signals={[]}
				activity={[]}
				primaryItemId="ITEM-9"
				onReviewDecision={onReviewDecision}
				onOpenItem={vi.fn()}
				onOpenActivity={vi.fn()}
				onOpenWork={vi.fn()}
				onOpenSignal={vi.fn()}
			/>,
		);

		expect(screen.getByText("Prioridade agora")).toBeTruthy();
		expect(
			screen.getByText("Um gate humano impede o fluxo de avancar sem sua decisao."),
		).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Decisoes pendentes" })).toBeTruthy();
		expect(screen.getByText("Aprovar contrato publico")).toBeTruthy();
		expect(screen.getByText(/nenhuma mudanca ocorre antes da sua decisao/i)).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Revisar decisao prioritaria" }));
		expect(onReviewDecision).toHaveBeenCalledWith("ITEM-9");
	});

	it("surfaces health signals as supervisory evidence", async () => {
		const user = userEvent.setup();
		const onOpenSignal = vi.fn();
		const onScanHealth = vi.fn();

		render(
			<SupervisionInbox
				decisions={[]}
				healthSummary={{ novo: 1, ciente: 0, resolvido: 2, descartado: 0 }}
				signals={[
					{
						id: "health-1",
						title: "Validacao falhou",
						source: "validate-conflict",
						severity: "alta",
						status: "novo",
						impact: "bloqueia conclusao",
						nextAction: "investigar",
					},
				]}
				activity={[
					{
						id: "event-1",
						action: "validate",
						description: "Validacao interrompida por conflito",
						timestamp: "2026-07-04T10:00:00.000Z",
						itemId: "ITEM-62",
					},
				]}
				primaryItemId="ITEM-62"
				onReviewDecision={vi.fn()}
				onOpenItem={vi.fn()}
				onOpenActivity={vi.fn()}
				onOpenWork={vi.fn()}
				onOpenSignal={onOpenSignal}
				onScanHealth={onScanHealth}
			/>,
		);

		expect(screen.getByRole("heading", { name: "Saude do workspace" })).toBeTruthy();
		expect(screen.getByText("Validacao falhou")).toBeTruthy();
		expect(screen.getAllByText("bloqueia conclusao").length).toBeGreaterThan(0);
		expect(screen.getByText("Resolvidos")).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Ultimas evidencias" })).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Examinar evidencias" }));
		expect(onOpenSignal).toHaveBeenCalledWith(expect.objectContaining({ id: "health-1" }));

		await user.click(screen.getByRole("button", { name: "Verificar agora" }));
		expect(onScanHealth).toHaveBeenCalledOnce();
	});

	it("uses honest empty states and opens focused work without mutating it", async () => {
		const user = userEvent.setup();
		const onOpenItem = vi.fn();

		render(
			<SupervisionInbox
				decisions={[]}
				signals={[]}
				activity={[]}
				primaryItemId="ITEM-62"
				onReviewDecision={vi.fn()}
				onOpenItem={onOpenItem}
				onOpenActivity={vi.fn()}
				onOpenWork={vi.fn()}
				onOpenSignal={vi.fn()}
			/>,
		);

		expect(screen.getByText("Nenhuma decisao aguarda voce.")).toBeTruthy();
		expect(screen.getByText("Nenhum sinal ativo de saude.")).toBeTruthy();
		expect(
			screen.getByText(
				"Historico resolvido ou descartado fica em Atividade; esta area mostra apenas o que pede investigacao agora.",
			),
		).toBeTruthy();
		expect(screen.getByText("Em foco por ser o item central da sessao atual.")).toBeTruthy();
		expect(screen.getByText("Nenhuma atividade registrada.")).toBeTruthy();
		expect(screen.getByText(/abre o item sem alterar seu estagio/i)).toBeTruthy();

		await user.click(screen.getByRole("button", { name: "Abrir trabalho em foco" }));
		expect(onOpenItem).toHaveBeenCalledWith("ITEM-62");
	});

	it("communicates unavailable health and scan progress without hiding supervision", () => {
		render(
			<SupervisionInbox
				decisions={[]}
				signals={[]}
				activity={[]}
				signalsAvailable={false}
				healthBusy
				onScanHealth={vi.fn()}
				onReviewDecision={vi.fn()}
				onOpenItem={vi.fn()}
				onOpenActivity={vi.fn()}
				onOpenWork={vi.fn()}
				onOpenSignal={vi.fn()}
			/>,
		);

		expect(screen.getByText("Saude indisponivel agora.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Verificando" }).hasAttribute("disabled")).toBe(
			true,
		);
		expect(
			screen.getByText(
				"A supervisao continua disponivel, mas sem a fotografia de saude do workspace.",
			),
		).toBeTruthy();
	});
});
