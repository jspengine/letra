import type { IncomingMessage, ServerResponse } from "node:http";

export interface DiagnosticsEventPayload {
	fixes: number;
	suggestions: number;
	errors: number;
}

export interface SystemActionEventPayload {
	actionId: string;
	outcome: "armed" | "triggered" | "completed" | "failed";
}

export class FlowServerEvents {
	private clients = new Set<ServerResponse>();

	handleSse(req: IncomingMessage, res: ServerResponse): void {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});
		res.write("event: connected\ndata: {}\n\n");
		this.clients.add(res);
		req.on("close", () => this.clients.delete(res));
	}

	broadcastWorkflowUpdated(): void {
		this.broadcast("workflow-updated", {});
	}

	broadcastDiagnosticsUpdated(payload: DiagnosticsEventPayload): void {
		this.broadcast("diagnostics-updated", payload);
	}

	broadcastSystemActionUpdated(payload: SystemActionEventPayload): void {
		this.broadcast("system-action-updated", payload);
	}

	close(): void {
		for (const client of this.clients) {
			client.destroy();
		}
		this.clients.clear();
	}

	private broadcast(event: string, payload: unknown): void {
		if (this.clients.size === 0) return;
		const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
		for (const client of this.clients) {
			try {
				client.write(data);
			} catch {
				this.clients.delete(client);
			}
		}
	}
}
