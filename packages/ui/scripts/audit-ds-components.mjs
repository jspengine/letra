import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const packageRoot = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const srcRoot = join(packageRoot, "src");

const ignoredComponentFiles = new Set(["index.ts", "index.css", "utils.ts", "token-components.tsx"]);
const rawInteractivePattern = /<(button|select|input|textarea|table|dialog|details)\b|<hr\b|role=["']button["']/;
const hardcodedColorPattern = /#[0-9a-fA-F]{3,8}\b|rgba?\(|\b(?:bg|text|border)-(?:black|white|red|green|blue|yellow|purple|orange|slate|gray|zinc|neutral|stone|emerald|amber|rose|sky|indigo)-/;
const layoutSmellPattern = /\bspace-[xy]-|\bz-\d+|\bz-\[/;

function walk(dir, files = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			walk(full, files);
		} else {
			files.push(full);
		}
	}
	return files;
}

function read(file) {
	return readFileSync(file, "utf8");
}

function storyKey(file) {
	return basename(file).replace(/\.stories\.tsx$/, "");
}

function componentKey(file) {
	return basename(file).replace(/\.tsx$/, "");
}

function hasXds(source) {
	return source.includes('"x-ds"') || source.includes("'x-ds'");
}

function storiesForComponent(component, stories) {
	return stories.filter((story) => story.key === component.key || story.key === component.key.replace(/^patterns[\\/]/, ""));
}

function scanSource(source) {
	return {
		rawInteractive: rawInteractivePattern.test(source),
		hardcodedColor: hardcodedColorPattern.test(source),
		inlineStyle: /style=\{\{/.test(source),
		layoutSmell: layoutSmellPattern.test(source),
	};
}

const nativeWrapperAllowlist = new Set([
	"button",
	"checkbox",
	"input",
	"textarea",
	"table",
]);

function normalizeComponentScan(component) {
	if (nativeWrapperAllowlist.has(component.key)) {
		return {
			...component,
			scan: {
				...component.scan,
				rawInteractive: false,
			},
		};
	}
	return component;
}

const allFiles = walk(srcRoot);
const componentFiles = allFiles
	.filter((file) => file.endsWith(".tsx"))
	.filter((file) => !file.endsWith(".stories.tsx"))
	.filter((file) => !ignoredComponentFiles.has(basename(file)));

const storyFiles = allFiles.filter((file) => file.endsWith(".stories.tsx"));
const stories = storyFiles.map((file) => {
	const source = read(file);
	return {
		key: storyKey(file),
		path: relative(packageRoot, file).replaceAll("\\", "/"),
		xds: hasXds(source),
		scan: scanSource(source),
	};
});

const components = componentFiles.map((file) => {
	const source = read(file);
	const key = componentKey(file);
	const matchedStories = storiesForComponent({ key }, stories);
	return {
		key,
		path: relative(packageRoot, file).replaceAll("\\", "/"),
		story: matchedStories.length > 0,
		xds: matchedStories.some((story) => story.xds),
		scan: scanSource(source),
		stories: matchedStories.map((story) => story.path),
	};
}).map(normalizeComponentScan);

const missingStory = components.filter((component) => !component.story);
const missingXds = stories.filter((story) => !story.xds);
const sourceFindings = components.filter((component) =>
	component.scan.rawInteractive
	|| component.scan.hardcodedColor
	|| component.scan.inlineStyle
	|| component.scan.layoutSmell,
);
const storyFindings = stories.filter((story) =>
	story.scan.rawInteractive
	|| story.scan.hardcodedColor
	|| story.scan.inlineStyle
	|| story.scan.layoutSmell,
);

const summary = {
	components: components.length,
	stories: stories.length,
	missingStory: missingStory.length,
	storiesMissingXds: missingXds.length,
	sourceFindings: sourceFindings.length,
	storyFindings: storyFindings.length,
};

console.log("DS component audit");
console.log(JSON.stringify(summary, null, 2));

function printSection(title, rows, format) {
	if (rows.length === 0) return;
	console.log(`\n${title}`);
	for (const row of rows) console.log(`- ${format(row)}`);
}

printSection("Components without a Storybook story", missingStory, (row) => row.path);
printSection("Stories without x-ds metadata", missingXds, (row) => row.path);
printSection("Component source findings", sourceFindings, (row) => {
	const flags = Object.entries(row.scan).filter(([, value]) => value).map(([key]) => key).join(", ");
	return `${row.path} (${flags})`;
});
printSection("Story source findings", storyFindings, (row) => {
	const flags = Object.entries(row.scan).filter(([, value]) => value).map(([key]) => key).join(", ");
	return `${row.path} (${flags})`;
});

if (missingStory.length > 0 || missingXds.length > 0 || sourceFindings.length > 0 || storyFindings.length > 0) {
	process.exitCode = 1;
}
