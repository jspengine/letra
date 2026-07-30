// ds:validate — checks that all referenced CSS variables have definitions
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");

// Parse token definitions from UI package index.css
const CSS_PATH = join(ROOT, "ui", "src", "index.css");
const css = readFileSync(CSS_PATH, "utf-8");

const TOKEN_DEFS = new Set();
for (const m of css.matchAll(/--([\w-]+)\s*:/g)) {
	TOKEN_DEFS.add(m[1]);
}

// Legacy tokens that components may still use
const LEGACY = new Set([
	"background",
	"foreground",
	"muted",
	"muted-foreground",
	"card",
	"card-foreground",
	"border",
	"secondary",
	"secondary-foreground",
	"primary",
	"primary-foreground",
	"accent",
	"accent-foreground",
	"ring",
	"success",
	"success-foreground",
	"warning",
	"warning-foreground",
	"error",
	"error-foreground",
	"info",
	"info-foreground",
	"live",
]);

const ALL_DEFS = new Set([...TOKEN_DEFS, ...LEGACY]);
const VAR_REF = /var\(--([\w-]+)\)/g;

function walk(dir, files) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
			walk(full, files);
		} else if (entry.isFile() && /\.(tsx|ts|css)$/.test(entry.name)) {
			files.push(full);
		}
	}
}

const SRC_DIRS = [join(ROOT, "ui", "src"), join(ROOT, "client", "src")];

const missing = new Map();

for (const dir of SRC_DIRS) {
	const files = [];
	walk(dir, files);

	for (const file of files) {
		if (file === CSS_PATH) continue;
		const content = readFileSync(file, "utf-8");
		const lines = content.split("\n");
		for (const m of content.matchAll(VAR_REF)) {
			const token = m[1];
			if (!ALL_DEFS.has(token)) {
				const matchIndex = m.index;
				const lineNumber = content.slice(0, matchIndex).split("\n").length;
				const entry = `${file}:${lineNumber}`;
				if (!missing.has(token)) {
					missing.set(token, [entry]);
				} else if (!missing.get(token).includes(entry)) {
					missing.get(token).push(entry);
				}
			}
		}
	}
}

if (missing.size > 0) {
	console.error("Undefined CSS variables referenced:");
	for (const [token, refs] of [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
		for (const ref of refs) {
			console.error(`  --${token}  <=  ${ref}`);
		}
	}
	process.exit(1);
} else {
	console.log("✓ All referenced CSS variables have definitions.");
}
