import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon, Textarea } from "@letra/ui";
import { cn } from "../../lib/utils";
import { Markdown } from "./markdown";
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

interface DocumentEditorProps {
	file: string;
	initialContent: string;
	onSave: (content: string) => Promise<void>;
	title: string;
	description?: string;
}

export function DocumentEditor({
	file,
	initialContent,
	onSave,
	title,
	description,
}: DocumentEditorProps) {
	const [mode, setMode] = useState<"read" | "edit">("read");
	const [content, setContent] = useState(initialContent);
	const [saving, setSaving] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [progress, setProgress] = useState(0);
	const [activeSection, setActiveSection] = useState<string | null>(null);
	const previewRef = useRef<HTMLDivElement>(null);

	const isDirty = content !== initialContent;

	const sections = useMemo(() => extractMarkdownSections(content), [content]);
	const labels = useMemo(() => sections.map((s) => s.label), [sections]);

	useEffect(() => {
		setContent(initialContent);
		setMode("read");
	}, [file, initialContent]);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el || mode !== "read") return;
		const container = el;
		function onScroll() {
			const { scrollTop, scrollHeight, clientHeight } = container;
			const max = scrollHeight - clientHeight;
			setProgress(max > 0 ? Math.min(scrollTop / max, 1) : 0);
			const headings = container.querySelectorAll("h2");
			let found: string | null = sections[0]?.id ?? null;
			for (const h of headings) {
				const text = h.textContent?.trim() ?? "";
				const idx = labels.indexOf(text);
				if (idx === -1) continue;
				const offset = h.getBoundingClientRect().top - container.getBoundingClientRect().top;
				if (offset < 200) found = sections[idx]?.id ?? null;
			}
			setActiveSection(found);
		}
		container.addEventListener("scroll", onScroll, { passive: true });
		onScroll();
		return () => container.removeEventListener("scroll", onScroll);
	}, [mode, sections, labels]);

	// Sync preview scroll with editor scroll
	function handleEditorScroll() {
		if (!previewRef.current) return;
		previewRef.current.scrollTop = 0;
	}

	const handleSave = useCallback(async () => {
		setSaving(true);
		try {
			await onSave(content);
			setMode("read");
		} finally {
			setSaving(false);
		}
	}, [content, onSave]);

	function handleCancel() {
		if (isDirty && !window.confirm("Descartar alterações não salvas?")) return;
		setContent(initialContent);
		setMode("read");
	}

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "s") {
				e.preventDefault();
				if (isDirty) handleSave();
			}
		},
		[isDirty, handleSave],
	);

	return (
		<div className="flex flex-col flex-1 min-h-0">
			{mode === "read" ? (
				<>
					<div className="shrink-0">
						<RulerHeader
							title={title}
							description={description}
							progress={progress}
							sections={sections}
							activeSection={activeSection}
							actions={
								<Button size="sm" onClick={() => setMode("edit")}>
									Editar
								</Button>
							}
						/>
					</div>
					<div
						ref={scrollRef}
						className="flex-1 overflow-y-auto p-6"
						style={{ background: "var(--background)" }}
					>
						<div className="max-w-3xl mx-auto">
							<Markdown content={content} />
						</div>
					</div>
				</>
			) : (
				<div className="flex flex-col flex-1 min-h-0" onKeyDown={handleKeyDown}>
					<div
						className="flex items-center gap-2 px-4 py-2 border-b shrink-0"
						style={{ borderColor: "var(--border)", background: "var(--card)" }}
					>
						<span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>
							{title}
						</span>
						{isDirty && (
							<span
								className="w-2 h-2 rounded-full animate-pulse"
								style={{ background: "var(--warning)" }}
								title="Alterações não salvas"
								role="status"
								aria-label="Alterações não salvas"
							>
								<span className="sr-only">Alterações não salvas</span>
							</span>
						)}
						<div className="flex-1" />
						<Button size="sm" onClick={handleSave} loading={saving} disabled={!isDirty}>
							Salvar
						</Button>
						<Button size="sm" variant="ghost" onClick={handleCancel}>
							Cancelar
						</Button>
					</div>
					<div className="relative grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
						<div className="flex-1 flex flex-col min-h-0 min-w-0">
							<div
								className="flex items-center gap-2 px-4 py-1.5 border-b shrink-0"
								style={{ borderColor: "var(--border)" }}
							>
								<span className="text-[10px] font-medium uppercase" style={{ color: "var(--muted-foreground)" }}>
									Editor
								</span>
							</div>
							<Textarea
								aria-label="Conteúdo Markdown"
								value={content}
								onChange={(e) => setContent(e.target.value)}
								onScroll={handleEditorScroll}
								className="flex-1 resize-none px-4 py-3 text-sm leading-relaxed border-none outline-none"
								style={{
									background: "var(--background)",
									color: "var(--foreground)",
									fontFamily: "var(--font-code)",
								}}
								spellCheck={false}
							/>
						</div>
						<div
							className="hidden lg:block absolute inset-y-0 left-1/2 w-px"
							style={{ background: "var(--border)" }}
						/>
						<div className="flex-1 flex flex-col min-h-0 min-w-0">
							<div
								className="flex items-center gap-2 px-4 py-1.5 border-b shrink-0"
								style={{ borderColor: "var(--border)" }}
							>
								<span className="text-[10px] font-medium uppercase" style={{ color: "var(--muted-foreground)" }}>
									Preview
								</span>
							</div>
							<div
								ref={previewRef}
								className="flex-1 overflow-y-auto px-4 py-3"
								style={{ background: "var(--surface-1)" }}
							>
								<Markdown content={content} />
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
