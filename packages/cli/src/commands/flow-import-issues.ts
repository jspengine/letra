import { resolve } from "node:path";
import chalk from "chalk";
import { type Item, type Workflow, loadWorkflow, writeWorkflow } from "./flow-init.js";

function now(): string {
	return new Date().toISOString();
}

function nextItemId(workflow: Workflow): string {
	let max = 0;
	for (const item of workflow.items) {
		const match = item.id.match(/^ITEM-(\d+)$/);
		if (match) {
			const num = Number.parseInt(match[1], 10);
			if (num > max) max = num;
		}
	}
	return `ITEM-${max + 1}`;
}

function ensureWorkflow(root: string): Workflow {
	const workflow = loadWorkflow(root);
	if (!workflow) {
		console.log(chalk.red("No workflow found. Run 'letra flow init --quick' first"));
		process.exit(1);
	}
	if (workflow.stages.length === 0) {
		console.log(chalk.red("Workflow has no stages defined"));
		process.exit(1);
	}
	return workflow;
}

interface ImportResult {
	imported: number;
	total: number;
}

interface GitHubIssue {
	title: string;
	html_url: string;
	number: number;
	labels?: Array<{ name: string }>;
}

export async function backlogImportGitHub(
	root: string,
	repo: string,
	options?: { label?: string; limit?: number },
): Promise<ImportResult> {
	const workflow = ensureWorkflow(root);
	const limit = options?.limit ?? 50;
	const token = process.env.GITHUB_TOKEN;

	const url = new URL(`https://api.github.com/repos/${repo}/issues`);
	url.searchParams.set("state", "open");
	url.searchParams.set("per_page", String(limit));
	if (options?.label) {
		url.searchParams.set("labels", options.label);
	}

	const headers: Record<string, string> = {
		Accept: "application/vnd.github.v3+json",
		"User-Agent": "letra-cli",
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	let response: Response;
	try {
		response = await fetch(url.toString(), { headers });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(chalk.red(`Failed to fetch issues: ${msg}`));
		process.exit(1);
	}

	if (!response.ok) {
		const text = await response.text().catch(() => "unknown error");
		if (response.status === 404) {
			console.log(chalk.red(`Repository "${repo}" not found or is private`));
		} else if (response.status === 401 || response.status === 403) {
			console.log(chalk.red(`GitHub API error (${response.status}). Check GITHUB_TOKEN`));
		} else {
			console.log(chalk.red(`GitHub API error (${response.status}): ${text}`));
		}
		process.exit(1);
	}

	let issues: GitHubIssue[];
	try {
		issues = (await response.json()) as GitHubIssue[];
	} catch {
		console.log(chalk.red("Failed to parse GitHub response"));
		process.exit(1);
	}

	issues = issues.filter((i) => !("pull_request" in i));

	if (issues.length === 0) {
		console.log(chalk.yellow("No open issues found"));
		return { imported: 0, total: 0 };
	}

	const firstStage = workflow.stages[0].id;
	let imported = 0;

	for (const issue of issues) {
		const labels = issue.labels?.map((l) => l.name).join(", ") || "";
		const description = labels
			? `[${issue.number}] ${issue.title} (${labels})`
			: `[${issue.number}] ${issue.title}`;

		const item: Item = {
			id: nextItemId(workflow),
			description,
			stage: firstStage,
			createdAt: now(),
			source: "github",
			sourceUrl: issue.html_url,
		};

		workflow.items.push(item);
		imported++;
	}

	workflow.updatedAt = now();
	writeWorkflow(root, { workflow, source: "flow-import", skipSitrep: true, quiet: true });

	console.log(
		`  ${chalk.green("✓")} Imported ${chalk.cyan(String(imported))} issue${imported !== 1 ? "s" : ""} from ${chalk.cyan(repo)}`,
	);

	return { imported, total: issues.length };
}

interface LinearIssue {
	id: string;
	title: string;
	url: string;
	identifier: string;
}

export async function backlogImportLinear(
	root: string,
	team: string,
	options?: { limit?: number },
): Promise<ImportResult> {
	const apiKey = process.env.LINEAR_API_KEY;

	if (!apiKey) {
		console.log(chalk.red("LINEAR_API_KEY environment variable is required for Linear import"));
		process.exit(1);
	}

	const workflow = ensureWorkflow(root);
	const limit = options?.limit ?? 50;

	const query = `
		query($team: String!, $limit: Int!) {
			team(key: $team) {
				issues(first: $limit, filter: { state: { type: { in: [todo, inProgress] } } }) {
					nodes {
						id
						title
						url
						identifier
					}
				}
			}
		}`;

	let response: Response;
	try {
		response = await fetch("https://api.linear.app/graphql", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: apiKey,
			},
			body: JSON.stringify({ query, variables: { team, limit } }),
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(chalk.red(`Failed to fetch Linear issues: ${msg}`));
		process.exit(1);
	}

	if (!response.ok) {
		const text = await response.text().catch(() => "unknown error");
		if (response.status === 401) {
			console.log(chalk.red("Invalid Linear API key. Check LINEAR_API_KEY"));
		} else {
			console.log(chalk.red(`Linear API error (${response.status}): ${text}`));
		}
		process.exit(1);
	}

	let data: { data?: { team?: { issues?: { nodes?: LinearIssue[] } } } };
	try {
		data = (await response.json()) as typeof data;
	} catch {
		console.log(chalk.red("Failed to parse Linear response"));
		process.exit(1);
	}

	if (data.data?.team?.issues?.nodes == null) {
		const errMsg =
			data?.data?.team == null ? `Team "${team}" not found` : "Failed to fetch Linear issues";
		console.log(chalk.red(errMsg));
		process.exit(1);
	}

	const issues = data.data.team.issues.nodes;
	if (issues.length === 0) {
		console.log(chalk.yellow(`No open issues found for team "${team}"`));
		return { imported: 0, total: 0 };
	}

	const firstStage = workflow.stages[0].id;
	let imported = 0;

	for (const issue of issues) {
		const description = `${issue.identifier} ${issue.title}`;
		const item: Item = {
			id: nextItemId(workflow),
			description,
			stage: firstStage,
			createdAt: now(),
			source: "linear",
			sourceUrl: issue.url,
		};
		workflow.items.push(item);
		imported++;
	}

	workflow.updatedAt = now();
	writeWorkflow(root, { workflow, source: "flow-import", skipSitrep: true, quiet: true });

	console.log(
		`  ${chalk.green("✓")} Imported ${chalk.cyan(String(imported))} issue${imported !== 1 ? "s" : ""} from Linear team ${chalk.cyan(team)}`,
	);

	return { imported, total: issues.length };
}

export async function backlogImportGitHubAction(
	targetPath: string | undefined,
	repo: string,
	options: { label?: string; limit?: string },
): Promise<void> {
	const root = resolve(process.cwd(), targetPath || ".");
	await backlogImportGitHub(root, repo, {
		label: options.label,
		limit: options.limit ? Number(options.limit) : undefined,
	});
}

export async function backlogImportLinearAction(
	targetPath: string | undefined,
	team: string,
	options: { limit?: string },
): Promise<void> {
	const root = resolve(process.cwd(), targetPath || ".");
	await backlogImportLinear(root, team, {
		limit: options.limit ? Number(options.limit) : undefined,
	});
}
