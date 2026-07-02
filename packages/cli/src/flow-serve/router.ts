import type { RequestContext } from "./request-context.js";

export type RouteHandler = (context: RequestContext) => boolean | Promise<boolean>;

export class FlowServerRouter {
	private readonly handlers: RouteHandler[] = [];

	register(handler: RouteHandler): void {
		this.handlers.push(handler);
	}

	async dispatch(context: RequestContext): Promise<boolean> {
		for (const handler of this.handlers) {
			if (await handler(context)) return true;
		}
		return false;
	}
}
