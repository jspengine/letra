import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { join } from "node:path";
import { getLetraDir } from "../workspace/resolver.js";
import { resolveLocalIdentity } from "./service.js";

export interface SignedOperationProof {
	issuedAt: string;
	nonce: string;
	signature: string;
}

const MAX_PROOF_AGE_MS = 5 * 60_000;

function keyDirectory(root: string): string {
	return join(getLetraDir(root), "identity", "keys");
}

function proofPayload(root: string, actor: string, operation: string, details: unknown, issuedAt: string, nonce: string): Buffer {
	return Buffer.from(JSON.stringify({ workspace: resolve(getLetraDir(root)), actor, operation, details, issuedAt, nonce }), "utf8");
}

function privateKeyFor(root: string) {
	const directory = keyDirectory(root);
	const path = join(directory, "private.pem");
	mkdirSync(directory, { recursive: true });
	if (!existsSync(path)) {
		const keys = generateKeyPairSync("ed25519", {
			privateKeyEncoding: { type: "pkcs8", format: "pem" },
			publicKeyEncoding: { type: "spki", format: "pem" },
		});
		try { writeFileSync(path, keys.privateKey, { flag: "wx", mode: 0o600 }); }
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
	}
	const privateKey = createPrivateKey(readFileSync(path));
	const publicPath = join(directory, "public.pem");
	if (!existsSync(publicPath)) writeFileSync(publicPath, createPublicKey(privateKey).export({ type: "spki", format: "pem" }), { flag: "wx" });
	return privateKey;
}

/** Only a trusted local CLI or a server handler with a verified human session may call this. */
export function signLocalOperation(root: string, actor: string, operation: string, details: unknown): SignedOperationProof {
	if (resolveLocalIdentity(root).id !== actor) throw new Error("LOCAL_IDENTITY_REQUIRED");
	const issuedAt = new Date().toISOString();
	const nonce = randomBytes(16).toString("hex");
	const signature = sign(null, proofPayload(root, actor, operation, details, issuedAt, nonce), privateKeyFor(root)).toString("base64url");
	return { issuedAt, nonce, signature };
}

export function assertSignedOperation(root: string, actor: string, operation: string, details: unknown, proof?: SignedOperationProof): void {
	if (!proof || !existsSync(join(getLetraDir(root), "identity", "local.json")) || resolveLocalIdentity(root).id !== actor) throw new Error("SIGNED_OPERATION_REQUIRED");
	const issuedAt = Date.parse(proof.issuedAt);
	if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_PROOF_AGE_MS || !/^[a-f0-9]{32}$/.test(proof.nonce)) throw new Error("SIGNED_OPERATION_EXPIRED");
	const publicPath = join(keyDirectory(root), "public.pem");
	if (!existsSync(publicPath)) throw new Error("SIGNED_OPERATION_REQUIRED");
	const valid = verify(null, proofPayload(root, actor, operation, details, proof.issuedAt, proof.nonce), createPublicKey(readFileSync(publicPath)), Buffer.from(proof.signature, "base64url"));
	if (!valid) throw new Error("SIGNED_OPERATION_INVALID");
	const usedDirectory = join(keyDirectory(root), "used");
	mkdirSync(usedDirectory, { recursive: true });
	try { writeFileSync(join(usedDirectory, proof.nonce), proof.issuedAt, { flag: "wx", mode: 0o600 }); }
	catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("SIGNED_OPERATION_REPLAYED"); throw error; }
}
