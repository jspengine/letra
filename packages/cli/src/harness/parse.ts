export function parseSimpleYaml(text: string): Record<string, unknown> {
	type Frame = { obj: Record<string, unknown>; indent: number; containerKey?: string };
	const root: Record<string, unknown> = {};
	const stack: Frame[] = [{ obj: root, indent: -1 }];

	const lines = text.split(/\r?\n/);
	for (const raw of lines) {
		const trimmed = raw.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const indent = raw.length - trimmed.length;

		while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
			stack.pop();
		}

		const parent = stack[stack.length - 1].obj;

		// list item
		const listMatch = trimmed.match(/^- \s*(.*)/);
		if (listMatch) {
			const content = listMatch[1].trim();
			const containerKey = stack[stack.length - 1].containerKey;
			if (!containerKey) continue;

			const arr: unknown[] = Array.isArray(parent[containerKey]) ? (parent[containerKey] as unknown[]) : [];
			parent[containerKey] = arr;

			const kv = content.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
			if (kv) {
				const obj: Record<string, unknown> = {};
				obj[kv[1]] = parseValue(kv[2]);
				arr.push(obj);
				stack.push({ obj, indent, containerKey });
			} else {
				arr.push(parseValue(content));
			}
			continue;
		}

		// key: value
		const kvMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
		if (kvMatch) {
			const key = kvMatch[1];
			const val = kvMatch[2].trim();

			if (!val) {
				const obj: Record<string, unknown> = {};
				parent[key] = obj;
				stack.push({ obj, indent, containerKey: key });
			} else {
				parent[key] = parseValue(val);
				stack[stack.length - 1].containerKey = key;
			}
			continue;
		}
	}

	return normalize(root);
}

function normalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalize);
	if (value && typeof value === "object") {
		const obj = value as Record<string, unknown>;
		for (const [k, v] of Object.entries(obj)) {
			obj[k] = normalize(v) as Record<string, unknown>[string];
		}
		unwrapSingleKeyArrays(obj);
		return obj;
	}
	return value;
}

function unwrapSingleKeyArrays(obj: Record<string, unknown>) {
	for (const key of Object.keys(obj)) {
		const value = obj[key];
		if (value && typeof value === "object" && !Array.isArray(value)) {
			const inner = value as Record<string, unknown>;
			const entries = Object.entries(inner);
			if (entries.length === 1 && entries[0][0] === key && Array.isArray(entries[0][1])) {
				obj[key] = entries[0][1];
			}
		}
	}
}

function parseValue(raw: string): unknown {
	if (raw === "true") return true;
	if (raw === "false") return false;
	if (raw === "null" || raw === "~") return null;
	if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
	if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
	if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) return raw.slice(1, -1);
	if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
		try { return JSON.parse(raw); } catch { /* fallthrough */ }
	}
	return raw;
}
