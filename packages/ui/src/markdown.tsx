import { Fragment, type ReactNode } from "react";
import { cn } from "./utils";

function inlineFormat(text: string): ReactNode[] {
	const parts: ReactNode[] = [];
	const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
	let last = 0;
	let match: RegExpExecArray | null;
	let key = 0;

	while ((match = re.exec(text)) !== null) {
		if (match.index > last) parts.push(text.slice(last, match.index));
		if (match[2]) {
			parts.push(<strong key={key++}>{match[2]}</strong>);
		} else if (match[4]) {
			parts.push(<em key={key++}>{match[4]}</em>);
		} else if (match[6]) {
			parts.push(
				<code
					key={key++}
					className="rounded px-1 py-0.5 text-xs"
					style={{
						backgroundColor: "var(--color-bg-surface)",
						color: "var(--color-text-primary)",
					}}
				>
					{match[6]}
				</code>,
			);
		} else if (match[8] && match[9]) {
			parts.push(
				<a
					key={key++}
					href={match[9]}
					target="_blank"
					rel="noopener noreferrer"
					className="underline underline-offset-2"
					style={{ color: "var(--color-primary)" }}
				>
					{match[8]}
				</a>,
			);
		}
		last = re.lastIndex;
	}

	if (last < text.length) parts.push(text.slice(last));
	return parts;
}

interface MarkdownProps {
	content: string;
	className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
	const lines = content.split("\n");
	const elements: ReactNode[] = [];
	let i = 0;
	let key = 0;

	while (i < lines.length) {
		const line = lines[i];
		const trimmed = line.trim();

		if (trimmed === "") {
			i++;
			continue;
		}

		if (trimmed.startsWith("```")) {
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trim().startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			i++;
			elements.push(
				<pre
					key={key++}
					className="overflow-x-auto rounded-[var(--radius-sm)] p-4 text-sm leading-relaxed"
					style={{ backgroundColor: "var(--color-bg-surface)" }}
				>
					<code>{codeLines.join("\n")}</code>
				</pre>,
			);
			continue;
		}

		if (trimmed.startsWith("> ")) {
			const quoteLines: string[] = [];
			while (i < lines.length && lines[i].trim().startsWith("> ")) {
				quoteLines.push(lines[i].trim().slice(2));
				i++;
			}
			elements.push(
				<blockquote
					key={key++}
					className="my-2 border-l-2 py-1 pl-4 text-sm"
					style={{
						borderColor: "var(--color-primary)",
						color: "var(--color-text-secondary)",
					}}
				>
					{quoteLines.map((ql, qi) => (
						<Fragment key={ql}>
							{inlineFormat(ql)}
							{qi < quoteLines.length - 1 && <br />}
						</Fragment>
					))}
				</blockquote>,
			);
			continue;
		}

		if (trimmed.startsWith("- ")) {
			const items: ReactNode[] = [];
			while (i < lines.length && lines[i].trim().startsWith("- ")) {
				items.push(
					<li key={items.length} className="text-sm">
						{inlineFormat(lines[i].trim().slice(2))}
					</li>,
				);
				i++;
			}
			elements.push(
				<ul key={key++} className="my-2 list-disc space-y-1 pl-5">
					{items}
				</ul>,
			);
			continue;
		}

		if (/^\d+\.\s/.test(trimmed)) {
			const items: ReactNode[] = [];
			while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
				items.push(
					<li key={items.length} className="text-sm">
						{inlineFormat(lines[i].trim().replace(/^\d+\.\s/, ""))}
					</li>,
				);
				i++;
			}
			elements.push(
				<ol key={key++} className="my-2 list-decimal space-y-1 pl-5">
					{items}
				</ol>,
			);
			continue;
		}

		if (
			trimmed.startsWith("|") &&
			i + 1 < lines.length &&
			/^\|[\s\-:]+\|/.test(lines[i + 1].trim())
		) {
			const tableLines: string[] = [];
			while (i < lines.length && lines[i].trim().startsWith("|")) {
				tableLines.push(lines[i].trim());
				i++;
			}
			const parseRow = (row: string) =>
				row
					.split("|")
					.slice(1, -1)
					.map((cell) => cell.trim());
			const headerCells = parseRow(tableLines[0]);
			const rows = tableLines.slice(2).map(parseRow);
			elements.push(
				<div key={key++} className="my-3 overflow-x-auto">
					<table
						className="w-full border-collapse text-sm"
						style={{ color: "var(--color-text-primary)" }}
					>
						<thead>
							<tr>
								{headerCells.map((cell) => (
									<th
										key={cell}
										className="border-b-2 px-3 py-2 text-left font-semibold"
										style={{ borderColor: "var(--border)" }}
									>
										{inlineFormat(cell)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, ri) => (
								<tr key={row.join("|") || ri}>
									{row.map((cell, ci) => (
										<td
											key={`${cell}-${ci}`}
											className="border-b px-3 py-1.5"
											style={{ borderColor: "var(--border)" }}
										>
											{inlineFormat(cell)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>,
			);
			continue;
		}

		if (/^-{3,}$/.test(trimmed)) {
			elements.push(
				<hr key={key++} className="my-4" style={{ borderColor: "var(--border)" }} />,
			);
			i++;
			continue;
		}

		if (/^#{1,3}\s/.test(trimmed)) {
			const level = trimmed.match(/^#+/)?.[0].length as 1 | 2 | 3;
			const headingText = trimmed.replace(/^#+\s/, "");
			const headingKey = key++;
			if (level === 1) {
				elements.push(
					<h2 key={headingKey} className="mb-3 mt-1 text-xl font-bold">
						{inlineFormat(headingText)}
					</h2>,
				);
			} else if (level === 2) {
				elements.push(
					<h2 key={headingKey} className="mb-2 mt-4 text-lg font-semibold">
						{inlineFormat(headingText)}
					</h2>,
				);
			} else {
				elements.push(
					<h3 key={headingKey} className="mb-1 mt-3 text-base font-semibold">
						{inlineFormat(headingText)}
					</h3>,
				);
			}
			i++;
			continue;
		}

		const paraLines: string[] = [line];
		i++;
		while (
			i < lines.length &&
			lines[i].trim() !== "" &&
			!lines[i].trim().startsWith("#") &&
			!lines[i].trim().startsWith("- ") &&
			!/^\d+\.\s/.test(lines[i].trim()) &&
			!lines[i].trim().startsWith("> ") &&
			!lines[i].trim().startsWith("```") &&
			!lines[i].trim().startsWith("|") &&
			!/^-{3,}$/.test(lines[i].trim())
		) {
			paraLines.push(lines[i]);
			i++;
		}
		elements.push(
			<p key={key++} className="mb-2 text-sm leading-relaxed">
				{inlineFormat(paraLines.join("\n"))}
			</p>,
		);
	}

	return <div className={cn("space-y-0", className)}>{elements}</div>;
}
