import { useEffect, useRef, useState, type ReactNode, useMemo } from "react";
import { RulerHeader } from "./RulerHeader";

export interface Section {
	id: string;
	label: string;
}

export function extractMarkdownSections(content: string): Section[] {
	const headings = content.match(/^##\s+(.+)/gm);
	if (!headings) return [];
	return headings.map((h) => {
		const label = h.replace(/^##\s+/, "");
		const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
		return { id, label };
	});
}

interface MarkdownViewProps {
	title: string;
	description?: string;
	sections: Section[];
	actions?: ReactNode;
	children: ReactNode;
}

export function MarkdownView({ title, description, sections, actions, children }: MarkdownViewProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [progress, setProgress] = useState(0);
	const [activeSection, setActiveSection] = useState<string | null>(null);
	const labels = useMemo(() => sections.map((s) => s.label), [sections]);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		function onScroll() {
			const { scrollTop, scrollHeight, clientHeight } = el;
			const max = scrollHeight - clientHeight;
			setProgress(max > 0 ? Math.min(scrollTop / max, 1) : 0);

			const headings = el.querySelectorAll("h2");
			let found: string | null = sections[0]?.id ?? null;
			for (const h of headings) {
				const text = h.textContent?.trim() ?? "";
				const idx = labels.indexOf(text);
				if (idx === -1) continue;
				const offset = h.getBoundingClientRect().top - el.getBoundingClientRect().top;
				if (offset < 200) {
					found = sections[idx]?.id ?? null;
				}
			}
			setActiveSection(found);
		}

		el.addEventListener("scroll", onScroll, { passive: true });
		onScroll();
		return () => el.removeEventListener("scroll", onScroll);
	}, [labels, sections]);

	return (
		<div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
			<div style={{ flexShrink: 0 }}>
				<RulerHeader
					title={title}
					description={description}
					progress={progress}
					sections={sections}
					activeSection={activeSection}
					actions={actions}
				/>
			</div>
			<div
				ref={scrollRef}
				style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "1.5rem" }}
			>
				{children}
			</div>
		</div>
	);
}
