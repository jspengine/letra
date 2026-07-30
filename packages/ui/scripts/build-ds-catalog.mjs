import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(root, "..");
const srcRoot = join(packageRoot, "src");
const outputPath = join(packageRoot, "catalog", "ds-catalog.json");

const requiredFields = ["category", "status", "tokens", "consumes", "surfaces", "a11y", "breakpoints"];
const requiredPrimitives = ["Button", "Badge", "Card", "Input", "Dialog", "Sheet", "Select", "Table", "Toast", "Tooltip"];
const requiredPatterns = ["Sidebar", "KanbanBoard", "GateCard", "ValidatingBar", "MarchingBorder", "Search", "ActivityTimeline", "NavHeader"];
const requiredSurfaces = ["HomeView", "FlowView", "ExecutionView", "ContextView", "SpecsView", "WorkspacesView"];

function walk(dir, files = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, files);
		} else if (entry.isFile() && entry.name.endsWith(".stories.tsx")) {
			files.push(full);
		}
	}
	return files;
}

function extractBalancedObject(source, key) {
	const keyIndex = source.indexOf(key);
	if (keyIndex === -1) return null;
	const start = source.indexOf("{", keyIndex);
	if (start === -1) return null;

	let depth = 0;
	for (let index = start; index < source.length; index += 1) {
		const char = source[index];
		if (char === "{") depth += 1;
		if (char === "}") depth -= 1;
		if (depth === 0) return source.slice(start, index + 1);
	}

	return null;
}

function readString(objectSource, field) {
	const match = objectSource.match(new RegExp(`${field}\\s*:\\s*"([^"]+)"`));
	return match?.[1] ?? null;
}

function readArray(objectSource, field) {
	const match = objectSource.match(new RegExp(`${field}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
	if (!match) return [];
	return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
}

function readStories(source) {
	return [...source.matchAll(/export const (\w+)\s*(?::[^=]+)?=/g)].map((match) => match[1]);
}

function componentNameFromTitle(title) {
	return title.split("/").at(-1) ?? title;
}

const entries = [];
const errors = [];

for (const file of walk(srcRoot)) {
	const source = readFileSync(file, "utf8");
	const defaultSource = extractBalancedObject(source, "export default");
	if (!defaultSource) continue;

	const xdsSource = extractBalancedObject(defaultSource, "\"x-ds\"");
	if (!xdsSource) continue;

	const title = readString(defaultSource, "title");
	if (!title) {
		errors.push(`${relative(packageRoot, file)} has x-ds but no default title`);
		continue;
	}

	const entry = {
		name: componentNameFromTitle(title),
		title,
		path: relative(packageRoot, file).replaceAll("\\", "/"),
		category: readString(xdsSource, "category"),
		status: readString(xdsSource, "status"),
		tokens: readArray(xdsSource, "tokens"),
		consumes: readArray(xdsSource, "consumes"),
		surfaces: readArray(xdsSource, "surfaces"),
		a11y: readArray(xdsSource, "a11y"),
		breakpoints: readArray(xdsSource, "breakpoints"),
		stories: readStories(source),
	};

	for (const field of requiredFields) {
		const value = entry[field];
		if (Array.isArray(value) ? value.length === 0 && field !== "consumes" : !value) {
			errors.push(`${entry.title} is missing x-ds.${field}`);
		}
	}

	entries.push(entry);
}

const primitiveNames = new Set(entries.filter((entry) => entry.category === "primitive").map((entry) => entry.name));
const patternNames = new Set(entries.filter((entry) => entry.category === "pattern").map((entry) => entry.name));
const surfaceEntry = entries.find((entry) => entry.category === "surface" && entry.title === "Surfaces/ClientViews");
const missingPrimitives = requiredPrimitives.filter((name) => !primitiveNames.has(name));
const missingPatterns = requiredPatterns.filter((name) => !patternNames.has(name));
const missingSurfaces = requiredSurfaces.filter((name) => !surfaceEntry?.surfaces.includes(name));
const missingSurfaceStories = requiredSurfaces
	.map((name) => name.replace(/View$/, ""))
	.filter((storyName) => !surfaceEntry?.stories.includes(storyName));

for (const name of missingPrimitives) errors.push(`missing primitive catalog entry: ${name}`);
for (const name of missingPatterns) errors.push(`missing pattern catalog entry: ${name}`);
if (!surfaceEntry) errors.push("missing surface catalog entry: Surfaces/ClientViews");
for (const name of missingSurfaces) errors.push(`missing surface catalog metadata: ${name}`);
for (const name of missingSurfaceStories) errors.push(`missing surface story export: ${name}`);

if (errors.length > 0) {
	console.error("DS catalog generation failed:");
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

const catalog = {
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	source: "storybook-x-ds",
	required: {
		primitives: requiredPrimitives,
		patterns: requiredPatterns,
		surfaces: requiredSurfaces,
	},
	coverage: {
		entries: entries.length,
		primitives: requiredPrimitives.length,
		patterns: requiredPatterns.length,
		surfaces: requiredSurfaces.length,
	},
	components: entries.sort((a, b) => a.title.localeCompare(b.title)),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Generated ${relative(packageRoot, outputPath)} with ${entries.length} entries.`);
