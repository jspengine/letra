import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(root, "storybook-static");
const indexPath = path.join(staticDir, "index.json");
const axePath = require.resolve("axe-core/axe.min.js");
const axeSource = await readFile(axePath, "utf8");

const criticalTitles = new Set([
	"Components/Button",
	"Components/Badge",
	"Components/Card",
	"Components/Input",
	"Components/Dialog",
	"Components/Drawer",
	"Components/NavigationMenu",
	"Components/Sheet",
	"Components/Select",
	"Components/Table",
	"Components/Toast",
	"Components/Tooltip",
	"Patterns/Sidebar",
	"Patterns/KanbanBoard",
	"Patterns/GateCard",
	"Patterns/ValidatingBar",
	"Patterns/MarchingBorder",
	"Patterns/Search",
	"Patterns/ActivityTimeline",
	"Patterns/NavHeader",
	"Surfaces/ClientViews",
]);

const mode = process.argv.includes("--visual") ? "visual" : "a11y";
const storyIndex = JSON.parse(await readFile(indexPath, "utf8"));
const stories = Object.values(storyIndex.entries)
	.filter((entry) => entry.type === "story" && criticalTitles.has(entry.title))
	.sort((a, b) => a.id.localeCompare(b.id));

if (stories.length === 0) {
	throw new Error("No critical DS stories found in storybook-static/index.json.");
}

const mimeTypes = new Map([
	[".html", "text/html; charset=utf-8"],
	[".js", "text/javascript; charset=utf-8"],
	[".css", "text/css; charset=utf-8"],
	[".json", "application/json; charset=utf-8"],
	[".svg", "image/svg+xml"],
	[".png", "image/png"],
	[".woff2", "font/woff2"],
]);

function startServer() {
	const server = createServer(async (request, response) => {
		const url = new URL(request.url ?? "/", "http://127.0.0.1");
		const requestPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
		const filePath = path.normalize(path.join(staticDir, requestPath));

		if (!filePath.startsWith(staticDir)) {
			response.writeHead(403);
			response.end("Forbidden");
			return;
		}

		try {
			const body = await readFile(filePath);
			response.writeHead(200, {
				"content-type": mimeTypes.get(path.extname(filePath)) ?? "application/octet-stream",
			});
			if (request.method === "HEAD") {
				response.end();
			} else {
				response.end(body);
			}
		} catch {
			response.writeHead(404);
			response.end("Not found");
		}
	});

	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			resolve({ server, origin: `http://127.0.0.1:${address.port}` });
		});
	});
}

async function waitForStory(page) {
	await page.waitForSelector("#storybook-root, #root", { timeout: 15000 });
	await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
}

async function assertStoryRendered(page, story) {
	const storybookError = page.getByText("The component failed to render properly").first();
	if (await storybookError.isVisible().catch(() => false)) {
		const heading = await page
			.locator("body")
			.innerText({ timeout: 1000 })
			.catch(() => "");
		throw new Error(`${story.id} rendered Storybook error: ${heading.split("\n")[0]}`);
	}

	const rootHtml = await page
		.locator("#storybook-root, #root")
		.first()
		.innerHTML({ timeout: 1000 })
		.catch(() => "");
	if (!rootHtml?.trim()) {
		throw new Error(`${story.id} rendered an empty Storybook root.`);
	}
}

function storyUrl(origin, story) {
	return `${origin}/iframe.html?id=${story.id}&viewMode=story`;
}

async function applyTheme(page, theme) {
	await page.evaluate((nextTheme) => {
		const root = document.querySelector("#storybook-root");
		for (const element of [document.documentElement, document.body, root].filter(Boolean)) {
			element.classList.remove("dark", "light");
			element.classList.add(nextTheme);
		}
	}, theme);
}

async function assertTokenStyles(page, story, selector, checks) {
	const result = await page.evaluate(
		({ selector: targetSelector, checks: targetChecks }) => {
			const target = document.querySelector(targetSelector);
			if (!target) return { ok: false, message: `${targetSelector} not found` };

			const computed = getComputedStyle(target);
			const probe = document.createElement("div");
			document.body.appendChild(probe);

			try {
				for (const check of targetChecks) {
					probe.style.color = "";
					probe.style.borderColor = "";
					probe.style.backgroundColor = "";
					probe.style[check.property] = `var(${check.token})`;
					const expected = getComputedStyle(probe)[check.property];
					const actual = computed[check.property];
					if (actual !== expected) {
						return {
							ok: false,
							message: `${targetSelector} ${check.property} expected ${check.token} (${expected}) but got ${actual}`,
						};
					}
				}
			} finally {
				probe.remove();
			}

			return { ok: true };
		},
		{ selector, checks },
	);

	if (!result.ok) {
		throw new Error(`${story.id}: ${result.message}`);
	}
}

async function validateInteractiveVisual(page, story) {
	if (story.title === "Components/Drawer" && story.name === "Default") {
		await page.locator('[data-slot="drawer-trigger"]').click();
		await page.waitForSelector('[data-slot="drawer-content"]', { timeout: 5000 });
		await assertTokenStyles(page, story, '[data-slot="drawer-content"]', [
			{ property: "backgroundColor", token: "--color-bg-surface" },
			{ property: "borderTopColor", token: "--color-border" },
			{ property: "color", token: "--color-text-primary" },
		]);
	}

	if (story.title === "Components/NavigationMenu" && story.name === "Default") {
		await page.locator('[data-slot="navigation-menu-trigger"]').first().click();
		await page.waitForSelector('[data-slot="navigation-menu-popup"]', { timeout: 5000 });
		await assertTokenStyles(page, story, '[data-slot="navigation-menu-popup"]', [
			{ property: "backgroundColor", token: "--color-bg-surface" },
			{ property: "borderTopColor", token: "--color-border" },
			{ property: "color", token: "--color-text-primary" },
		]);
	}
}

function formatViolation(story, violation) {
	const target = violation.nodes
		.flatMap((node) => node.target)
		.slice(0, 3)
		.join(", ");
	return `${story.id}: ${violation.id} (${violation.impact ?? "unknown"}) ${target}`;
}

const { server, origin } = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
	if (mode === "a11y") {
		const failures = [];

		for (const story of stories) {
			await page.goto(storyUrl(origin, story), { waitUntil: "domcontentloaded" });
			await waitForStory(page);
			await assertStoryRendered(page, story);
			await page.addScriptTag({ content: axeSource });
			const result = await page.evaluate(async () => {
				return window.axe.run(document.body, {
					runOnly: {
						type: "tag",
						values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
					},
				});
			});

			for (const violation of result.violations) {
				failures.push(formatViolation(story, violation));
			}
		}

		if (failures.length > 0) {
			console.error(`Storybook a11y found ${failures.length} violation(s):`);
			for (const failure of failures) {
				console.error(`- ${failure}`);
			}
			process.exitCode = 1;
		} else {
			console.log(`Storybook a11y passed for ${stories.length} critical DS stories.`);
		}
	} else {
		const outDir = path.join(root, "storybook-visual-snapshots");
		await rm(outDir, { recursive: true, force: true });
		await mkdir(outDir, { recursive: true });

		for (const story of stories) {
			for (const theme of ["dark", "light"]) {
				const isMobile = story.name.toLowerCase().includes("mobile");
				await page.setViewportSize(
					isMobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
				);
				await page.goto(storyUrl(origin, story), { waitUntil: "domcontentloaded" });
				await waitForStory(page);
				await applyTheme(page, theme);
				await assertStoryRendered(page, story);
				await validateInteractiveVisual(page, story);
				await page.screenshot({
					path: path.join(outDir, `${story.id}-${theme}.png`),
					fullPage: true,
				});
			}
		}

		console.log(
			`Storybook visual snapshots captured for ${stories.length} critical DS stories in dark and light themes.`,
		);
	}
} finally {
	await browser.close();
	await new Promise((resolve) => server.close(resolve));
}
