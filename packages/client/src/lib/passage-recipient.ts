export interface PassageRecipientSelection {
	recipient: string | null;
	error?: string;
	cancelled?: boolean;
}

export function selectPassageRecipient(
	recipients: string[],
	destinationName: string,
	choose: (message: string, initialValue: string) => string | null,
): PassageRecipientSelection {
	if (recipients.length === 0) {
		return { recipient: null, error: `O estágio ${destinationName} não tem destinatário configurado.` };
	}
	if (recipients.length === 1) return { recipient: recipients[0] };
	const recipient = choose(`Escolha o destinatário (${recipients.join(", ")}):`, recipients[0]);
	if (recipient === null) return { recipient: null, cancelled: true };
	if (!recipients.includes(recipient)) {
		return { recipient: null, error: `Destinatário "${recipient}" não pertence ao estágio ${destinationName}.` };
	}
	return { recipient };
}
