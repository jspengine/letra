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
		const id = label
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
		return { id, label };
	});
}

interface DocumentViewProps {
	title: string;
	sections: Section[];
	actions?: ReactNode;
	children: ReactNode;
}

export function DocumentView({ title, sections, actions, children }: DocumentViewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rulerRef = useRef<HTMLDivElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [progress, setProgress] = useState(0);
	const [activeSection, setActiveSection] = useState<string | null>(null);
	const [rect, setRect] = useState({ top: 0, left: 0, width: 0 });
	const labels = useMemo(() => sections.map((s) => s.label), [sections]);

	useEffect(() => {
		const c = containerRef.current;
		if (!c) return;
		function measure() {
			const r = c.getBoundingClientRect();
			setRect({ top: r.top, left: r.left, width: r.width });
		}
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	}, []);

	useEffect(() => {
		const s = scrollRef.current;
		if (!s) return;

		s.style.paddingTop = `${rulerRef.current?.offsetHeight ?? 60}px`;

		let raf: number;

		function onScroll() {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				const rect = s.getBoundingClientRect();
				const totalScrollable = s.scrollHeight - s.clientHeight;
				const scrollOffset = -rect.top;
				setProgress(
					totalScrollable > 0
						? Math.max(0, Math.min(scrollOffset / totalScrollable, 1))
						: 0,
				);

				const headings = s.querySelectorAll("h2");
				let found: string | null = sections[0]?.id ?? null;
				for (const h of headings) {
					const text = h.textContent?.trim() ?? "";
					const idx = labels.indexOf(text);
					if (idx === -1) continue;
					const offset = h.getBoundingClientRect().top - rect.top;
					if (offset < 200) {
						found = sections[idx]?.id ?? null;
					}
				}
				setActiveSection(found);
			});
		}

		s.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("scroll", onScroll, { passive: true });
		onScroll();

		return () => {
			cancelAnimationFrame(raf);
			s.removeEventListener("scroll", onScroll);
			window.removeEventListener("scroll", onScroll);
		};
	}, [labels, sections]);

	return (
		<div
			ref={containerRef}
			style={{
				flex: 1,
				minHeight: 0,
				position: "relative",
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div
				ref={rulerRef}
				style={{
					position: "fixed",
					top: rect.top,
					left: rect.left,
					width: rect.width,
					zIndex: 50,
				}}
			>
				<RulerHeader
					title={title}
					progress={progress}
					sections={sections}
					activeSection={activeSection}
					actions={actions}
				/>
			</div>
			<div
				ref={scrollRef}
				style={{
					flex: 1,
					minHeight: 0,
					overflowY: "auto",
				}}
			>
				<div className="p-6 max-w-3xl mx-auto">{children}</div>
			</div>
		</div>
	);
}
