import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

function isInside(root: string, candidate: string): boolean {
	const rel = relative(root, candidate);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export interface WorkspaceBoundary {
	root: string;
	assertPath(path: string): string;
}

export function createWorkspaceBoundary(root: string): WorkspaceBoundary {
	const requestedRoot = resolve(root);
	const realRoot = realpathSync(requestedRoot);

	function assertPath(path: string): string {
		const requestedPath = resolve(path);
		if (!isInside(requestedRoot, requestedPath)) {
			throw new Error(`Path is outside the workspace boundary: ${requestedPath}`);
		}

		const candidate = resolve(realRoot, relative(requestedRoot, requestedPath));
		let existingAncestor = candidate;
		while (!existsSync(existingAncestor)) {
			const parent = dirname(existingAncestor);
			if (parent === existingAncestor) break;
			existingAncestor = parent;
		}
		const realAncestor = realpathSync(existingAncestor);
		if (!isInside(realRoot, realAncestor)) {
			throw new Error(`Path resolves outside the workspace boundary: ${requestedPath}`);
		}
		if (existsSync(candidate)) {
			const realCandidate = realpathSync(candidate);
			if (!isInside(realRoot, realCandidate)) {
				throw new Error(`Path resolves outside the workspace boundary: ${requestedPath}`);
			}
			return realCandidate;
		}
		return candidate;
	}

	const letraDir = resolve(requestedRoot, ".letra");
	if (existsSync(letraDir)) assertPath(letraDir);

	return { root: realRoot, assertPath };
}
