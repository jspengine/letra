import type { IncomingMessage, ServerResponse } from "node:http";
import type { Workflow } from "../commands/flow-init.js";

export interface RequestWorkspaceBinding {
	workspaceRoot: string;
	workspaceDir: string;
	workflow: Workflow | null;
}

export interface RequestContext extends RequestWorkspaceBinding {
	req: IncomingMessage;
	res: ServerResponse;
	url: URL;
	path: string;
	method: string;
}

export function createRequestContext(
	req: IncomingMessage,
	res: ServerResponse,
	url: URL,
	binding: RequestWorkspaceBinding,
): RequestContext {
	return Object.freeze({
		req,
		res,
		url,
		path: url.pathname,
		method: req.method ?? "GET",
		workspaceRoot: binding.workspaceRoot,
		workspaceDir: binding.workspaceDir,
		workflow: binding.workflow,
	});
}
