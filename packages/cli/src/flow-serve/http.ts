import type { IncomingMessage, ServerResponse } from "node:http";

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

export class HttpBodyError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 413,
	) {
		super(message);
		this.name = "HttpBodyError";
	}
}

export async function readJson<T>(
	req: IncomingMessage,
	maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<T> {
	const chunks: Buffer[] = [];
	let size = 0;

	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.byteLength;
		if (size > maxBytes) {
			throw new HttpBodyError("Request body exceeds the allowed size", 413);
		}
		chunks.push(buffer);
	}

	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
	} catch {
		throw new HttpBodyError("Malformed JSON request body", 400);
	}
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
	res.writeHead(status, { "Content-Type": "application/json" });
	res.end(JSON.stringify(payload));
}

export function sendError(res: ServerResponse, status: number, message: string): void {
	sendJson(res, status, { error: message });
}

export function routeParam(path: string, pattern: string): string | null {
	const pathSegments = path.split("/").filter(Boolean);
	const patternSegments = pattern.split("/").filter(Boolean);
	if (pathSegments.length !== patternSegments.length) return null;

	let parameter: string | null = null;
	for (let index = 0; index < patternSegments.length; index += 1) {
		const expected = patternSegments[index];
		const actual = pathSegments[index];
		if (expected.startsWith(":")) {
			parameter = decodeURIComponent(actual);
			continue;
		}
		if (expected !== actual) return null;
	}
	return parameter;
}
