import { describe, expect, it, vi } from "vitest";
import { selectPassageRecipient } from "./passage-recipient";

describe("selectPassageRecipient", () => {
	it("uses the only configured recipient without prompting", () => {
		const choose = vi.fn();
		expect(selectPassageRecipient(["reviewer"], "Review", choose)).toEqual({ recipient: "reviewer" });
		expect(choose).not.toHaveBeenCalled();
	});

	it("asks the user to choose when several recipients are configured", () => {
		const choose = vi.fn(() => "security");
		expect(selectPassageRecipient(["reviewer", "security"], "Review", choose)).toEqual({ recipient: "security" });
		expect(choose).toHaveBeenCalledWith("Escolha o destinatário (reviewer, security):", "reviewer");
	});

	it("reports an actionable reason when there are no recipients", () => {
		const choose = vi.fn();
		expect(selectPassageRecipient([], "Review", choose)).toMatchObject({ recipient: null, error: "O estágio Review não tem destinatário configurado." });
		expect(choose).not.toHaveBeenCalled();
	});
});
