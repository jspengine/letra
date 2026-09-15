import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const root = process.cwd();
const launchSiteRoot = join(root, "apps", "launch-site");
const siteDir = join(launchSiteRoot, "public");
const htmlPath = join(siteDir, "index.html");
const html = readFileSync(htmlPath, "utf8");
const searchableHtml = html.toLowerCase();
const failures = [];

function fail(message) {
	failures.push(message);
}

function textIncludes(fragment, label = fragment) {
	if (!searchableHtml.includes(fragment.toLowerCase())) fail(`Missing required content: ${label}`);
}

for (const file of ["styles.css", "calculator.js", "assets/state.svg", "assets/flow.svg", "assets/gate.svg"]) {
	const path = join(siteDir, file);
	if (!existsSync(path)) fail(`Missing asset: ${file}`);
}

for (const file of ["state.txt", "flow.txt", "gate.txt"]) {
	const path = join(launchSiteRoot, "evidence", file);
	if (!existsSync(path)) fail(`Missing evidence file: ${file}`);
	const evidence = existsSync(path) ? readFileSync(path, "utf8") : "";
	for (const required of ["Comando:", "Origem:", "CLI:", "Data:", "Alt text:"]) {
		if (!evidence.includes(required)) fail(`${file} missing ${required}`);
	}
}

for (const required of [
	"Letra não é um Kanban",
	"O trabalho avança",
	"Capturar leads",
	"Organizar estudos",
	"Sua aprovação antes do envio",
	"Autonomia com limite claro",
	"npm install -g @letra-ai/cli",
	"letra validate",
	"não promete economia",
	"decisão precisa ser humana",
]) {
	textIncludes(required);
}

const docs = ["Modelo mental", "Regras, gates", "Protocolo", "MCP"];
for (const doc of docs) textIncludes(doc, `documentation link ${doc}`);

if (!/<html\b[^>]*\blang="pt-BR"/.test(html)) fail('HTML must declare lang="pt-BR"');
if (!/<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"/.test(html)) {
	fail("Missing responsive viewport meta tag");
}
if (!/<main\b[^>]*id="main"/.test(html)) fail("Primary narrative must render in a main landmark");
if (!/<nav\b[^>]*aria-label="[^"]+"/.test(html)) fail("Navigation must have an accessible label");
if (!/<section\b[^>]*aria-label(?:ledby)?="[^"]+"/.test(html)) fail("At least one section must be labelled for assistive tech");
if (/<button\b/i.test(html) && !/role="tab"/.test(html)) fail("Static page buttons must be interactive controls");
if (/<a\b(?![^>]*\bhref=)/i.test(html)) fail("Anchor without href found");
if (/<script\b(?![^>]*\bdefer\b)/i.test(html)) fail("Scripts must be deferred");

const imageTags = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
if (imageTags.length < 3) fail("Expected at least three images");
for (const tag of imageTags) {
	if (!/\balt="[^"]{20,}"/.test(tag)) fail(`Image missing descriptive alt text: ${tag}`);
	if (!/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)) fail(`Image missing stable dimensions: ${tag}`);
}

const hrefs = [...html.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1]);
for (const href of hrefs) {
	if (href.startsWith("http") || href.startsWith("#")) continue;
	const target = normalize(join(dirname(htmlPath), href));
	if (!target.startsWith(root) || !existsSync(target)) fail(`Broken local link: ${href}`);
}

for (const href of hrefs.filter((entry) => entry.includes("github.com"))) {
	if (!href.includes("jspengine/letra")) fail(`External documentation must point to Letra repository: ${href}`);
}

for (const asset of ["assets/state.svg", "assets/flow.svg", "assets/gate.svg"]) {
	const size = statSync(join(siteDir, asset)).size;
	if (size > 80_000) fail(`Asset too large for static launch page: ${asset}`);
}

const performanceBudget = [
	["index.html", 45_000],
	["styles.css", 24_000],
	["calculator.js", 8_000],
];
for (const [file, maxSize] of performanceBudget) {
	const size = statSync(join(siteDir, file)).size;
	if (size > maxSize) fail(`${file} exceeds static performance budget: ${size} > ${maxSize}`);
}

if (!html.includes("<script src=\"./calculator.js\" defer></script>")) {
	fail("Calculator script must be deferred so primary narrative renders without JavaScript");
}

if (failures.length) {
	console.error(failures.join("\n"));
	process.exit(1);
}

console.log("launch-site checks passed");
