import { Fragment, type ReactNode } from "react";
import { cn } from "../../lib/utils";

function inlineFormat(text: string): ReactNode[] {
	const parts: ReactNode[] = [];
	const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
	let last = 0;
	let match: RegExpExecArray | null;
	let key = 0;

	while ((match = re.exec(text)) !== null) {
		if (match.index > last) {
			parts.push(text.slice(last, match.index));
		}
		if (match[2]) {
			parts.push(<strong key={key++}>{match[2]}</strong>);
		} else if (match[4]) {
			parts.push(<em key={key++}>{match[4]}</em>);
		} else if (match[6]) {
			parts.push(
				<code key={key++} className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: "var(--muted)", color: "var(--foreground)" }}>
					{match[6]}
				</code>,
			);
		} else if (match[8] && match[9]) {
			parts.push(
				<a key={key++} href={match[9]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "var(--primary)" }}>
					{match[8]}
				</a>,
			);
		}
		last = re.lastIndex;
	}

	if (last < text.length) {
		parts.push(text.slice(last));
	}

	return parts;
}

function isAllLinesEmpty(lines: string[], start: number, end: number): boolean {
	for (let i = start; i < end; i++) {
		if (lines[i].trim() !== "") return false;
	}
	return true;
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

		// Fenced code block
		if (trimmed.startsWith("```")) {
			const lang = trimmed.slice(3).trim();
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trim().startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			i++; // skip closing ```
			elements.push(
				<pre
					key={key++}
					className="p-4 rounded-lg overflow-x-auto text-sm leading-relaxed"
					style={{ backgroundColor: "var(--muted)" }}
				>
					<code>{codeLines.join("\n")}</code>
				</pre>,
			);
			continue;
		}

		// Blockquote
		if (trimmed.startsWith("> ")) {
			const quoteLines: string[] = [];
			while (i < lines.length && lines[i].trim().startsWith("> ")) {
				quoteLines.push(lines[i].trim().slice(2));
				i++;
			}
			elements.push(
				<blockquote
					key={key++}
					className="pl-4 py-1 border-l-2 my-2 text-sm"
					style={{ borderColor: "var(--primary)", color: "var(--muted-foreground)" }}
				>
					{quoteLines.map((ql, qi) => (
						<Fragment key={qi}>
							{inlineFormat(ql)}
							{qi < quoteLines.length - 1 && <br />}
						</Fragment>
					))}
				</blockquote>,
			);
			continue;
		}

		// Unordered list
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
				<ul key={key++} className="list-disc pl-5 space-y-1 my-2">
					{items}
				</ul>,
			);
			continue;
		}

		// Ordered list
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
				<ol key={key++} className="list-decimal pl-5 space-y-1 my-2">
					{items}
				</ol>,
			);
			continue;
		}

		// Table
		if (trimmed.startsWith("|") && i + 1 < lines.length && /^\|[\s\-:]+\|/.test(lines[i + 1].trim())) {
			const tableLines: string[] = [];
			while (i < lines.length && lines[i].trim().startsWith("|")) {
				tableLines.push(lines[i].trim());
				i++;
			}

			const parseRow = (line: string) =>
				line
					.split("|")
					.slice(1, -1)
					.map((c) => c.trim());

			const headerCells = parseRow(tableLines[0]);
			const rows = tableLines.slice(2).map(parseRow);

			elements.push(
				<div key={key++} className="overflow-x-auto my-3">
					<table className="w-full text-sm border-collapse" style={{ color: "var(--foreground)" }}>
						<thead>
							<tr>
								{headerCells.map((h, ci) => (
									<th key={ci} className="text-left font-semibold px-3 py-2 border-b-2" style={{ borderColor: "var(--border)" }}>
										{inlineFormat(h)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, ri) => (
								<tr key={ri}>
									{row.map((c, ci) => (
										<td key={ci} className="px-3 py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
											{inlineFormat(c)}
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

		// Thematic break
		if (/^-{3,}$/.test(trimmed)) {
			elements.push(
				<hr key={key++} className="my-4" style={{ borderColor: "var(--border)" }} />,
			);
			i++;
			continue;
		}

		// Headings
		if (/^#{1,3}\s/.test(trimmed)) {
			const level = trimmed.match(/^#+/)![0].length as 1 | 2 | 3;
			const headingText = trimmed.replace(/^#+\s/, "");
			const headingKey = key++;
			if (level === 1) {
				elements.push(
					<h1 key={headingKey} className="text-xl font-bold mb-3 mt-1">
						{inlineFormat(headingText)}
					</h1>,
				);
			} else if (level === 2) {
				elements.push(
					<h2 key={headingKey} className="text-lg font-semibold mb-2 mt-4">
						{inlineFormat(headingText)}
					</h2>,
				);
			} else {
				elements.push(
					<h3 key={headingKey} className="text-base font-semibold mb-1 mt-3">
						{inlineFormat(headingText)}
					</h3>,
				);
			}
			i++;
			continue;
		}

		// Paragraph (default)
		const paraLines: string[] = [line];
		i++;
		while (i < lines.length && lines[i].trim() !== "" && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("- ") && !/^\d+\.\s/.test(lines[i].trim()) && !lines[i].trim().startsWith("> ") && !lines[i].trim().startsWith("```") && !lines[i].trim().startsWith("|") && !/^-{3,}$/.test(lines[i].trim())) {
			paraLines.push(lines[i]);
			i++;
		}
		elements.push(
			<p key={key++} className="text-sm leading-relaxed mb-2">
				{inlineFormat(paraLines.join("\n"))}
			</p>,
		);
	}

	return (
		<div className={cn("space-y-0", className)}>
			{elements}
		</div>
	);
}
