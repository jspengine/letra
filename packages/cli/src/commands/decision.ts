import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import chalk from "chalk";
import { Command } from "commander";

function sanitizeTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function today(): string {
	return new Date().toISOString().split("T")[0];
}

export default function decisionCommand() {
	const cmd = new Command("decision");

	cmd.command("new <title>")
		.description("Cria um novo Architecture Decision Record")
		.action((title: string) => {
			const root = resolve(process.cwd());
			const decisionsDir = join(root, ".letra", "decisions");
			const slug = sanitizeTitle(title);
			const filePath = join(decisionsDir, `${slug}.md`);

			if (!existsSync(decisionsDir)) {
				mkdirSync(decisionsDir, { recursive: true });
			}

			if (existsSync(filePath)) {
				console.log(
					chalk.red(`Decision "${slug}" already exists at .letra/decisions/${slug}.md`),
				);
				return;
			}

			const content = `# ${title}

**Date**: ${today()}
**Status**: proposed

## Context

Why is this decision needed? What problem does it solve?

## Decision

What was decided?

## Consequences

What are the trade-offs? What does this enable or prevent?
`;

			writeFileSync(filePath, content);
			console.log(chalk.green(`Decision "${slug}" created at .letra/decisions/${slug}.md`));
		});

	cmd.command("list")
		.description("Lista todos os Architecture Decision Records")
		.action(() => {
			const root = resolve(process.cwd());
			const decisionsDir = join(root, ".letra", "decisions");

			if (!existsSync(decisionsDir)) {
				console.log(chalk.yellow("No decisions directory found at .letra/decisions/"));
				return;
			}

			const files = readdirSync(decisionsDir)
				.filter((f) => f.endsWith(".md"))
				.sort();

			if (files.length === 0) {
				console.log(chalk.yellow("No decisions found"));
				return;
			}

			for (const file of files) {
				const content = readFileSync(join(decisionsDir, file), "utf-8");
				const firstLine = content.split("\n")[0]?.replace(/^#\s*/, "").trim() || file;
				console.log(`${chalk.cyan(file)}  ${firstLine}`);
			}
		});

	return cmd;
}
