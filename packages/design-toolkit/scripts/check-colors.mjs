// ds:check — scans src files for hardcoded color values (hex, rgb, hsl, oklch outside tokens)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");

const DIRS = [join(ROOT, "ui", "src"), join(ROOT, "client", "src")];

const ALLOWLIST = [
	"@import",
	"stage.color",
	"#6b7280",
	"oklch(0.627 0.194 149.214 / 0.4)",
	"oklch(0.627 0.194 149.214 / 0)",
];

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

let errors = 0;

for (const dir of DIRS) {
	const files = [];
	walk(dir, files);

	for (const file of files) {
		const content = readFileSync(file, "utf-8");
		const lines = content.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (ALLOWLIST.some((a) => line.includes(a))) continue;

			const hex = /#[0-9a-fA-F]{3,8}\b/;
			const func = /(?:rgb|rgba|hsl|hsla|oklch)\([^)]+\)/;

			const hexMatch = line.match(hex);
			const funcMatch = line.match(func);

			if (hexMatch) {
				console.error(`  ${file}:${i + 1}  hardcoded hex  ${hexMatch[0]}`);
				errors++;
			} else if (funcMatch) {
				const trimmed = line.trim();
				if (trimmed.includes("var(--")) continue;
				if (trimmed.startsWith("--")) continue;
				console.error(`  ${file}:${i + 1}  hardcoded color  ${funcMatch[0]}`);
				errors++;
			}
		}
	}
}

if (errors > 0) {
	console.error(`\n✖ ${errors} hardcoded color(s) found. Use CSS variables instead.`);
	process.exit(1);
} else {
	console.log("✓ No hardcoded colors found.");
}
