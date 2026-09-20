import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { userInfo } from "node:os";
import { resolveLocalIdentity } from "../identity/service.js";

const COOKIE_NAME = "letra_human_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface HumanSession {
	actor: string;
	expiresAt: number;
}

function cookieValue(req: IncomingMessage, name: string): string | null {
	for (const part of (req.headers.cookie ?? "").split(";")) {
		const [key, ...value] = part.trim().split("=");
		if (key === name) return value.join("=") || null;
	}
	return null;
}

function sameOrigin(req: IncomingMessage): boolean {
	const origin = req.headers.origin;
	const host = req.headers.host;
	if (!origin || !host) return false;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}

export class HumanSessionGateway {
	private readonly secret = randomBytes(32);
	private readonly sessions = new Map<string, HumanSession>();
	private readonly workspaceRoot: string;

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot;
	}

	establishNavigationSession(req: IncomingMessage, res: ServerResponse): void {
		if (req.method !== "GET" || req.url?.startsWith("/api/") || cookieValue(req, COOKIE_NAME)) return;
		const sessionId = randomBytes(32).toString("base64url");
		const username = userInfo().username.trim();
		if (!username) return;
		this.sessions.set(sessionId, { actor: resolveLocalIdentity(this.workspaceRoot).id, expiresAt: Date.now() + SESSION_TTL_MS });
		const signature = this.sign(sessionId);
		res.setHeader("Set-Cookie", `${COOKIE_NAME}=${sessionId}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`);
	}

	resolveHumanActor(req: IncomingMessage): string | null {
		if (!sameOrigin(req)) return null;
		const token = cookieValue(req, COOKIE_NAME);
		if (!token) return null;
		const separator = token.lastIndexOf(".");
		if (separator < 1) return null;
		const sessionId = token.slice(0, separator);
		const signature = token.slice(separator + 1);
		if (!this.validSignature(sessionId, signature)) return null;
		const session = this.sessions.get(sessionId);
		if (!session || session.expiresAt <= Date.now()) {
			this.sessions.delete(sessionId);
			return null;
		}
		return session.actor;
	}

	private sign(sessionId: string): string {
		return createHmac("sha256", this.secret).update(sessionId).digest("base64url");
	}

	private validSignature(sessionId: string, signature: string): boolean {
		const expected = Buffer.from(this.sign(sessionId));
		const actual = Buffer.from(signature);
		return expected.length === actual.length && timingSafeEqual(expected, actual);
	}
}
