import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { Markdown } from "./markdown";
import { RulerHeader, type DocumentSection } from "./ruler-header";
import { Textarea } from "./textarea";

export type Section = DocumentSection;

export function extractMarkdownSections(content: string): Section[] {
	const headings = content.match(/^##\s+(.+)/gm);
	if (!headings) return [];
	return headings.map((heading) => {
		const label = heading.replace(/^##\s+/, "");
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

	const isDirty = content !== initialContent;
	const sections = useMemo(() => extractMarkdownSections(content), [content]);
	const labels = useMemo(() => sections.map((section) => section.label), [sections]);

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
			for (const heading of headings) {
				const text = heading.textContent?.trim() ?? "";
				const idx = labels.indexOf(text);
				if (idx === -1) continue;
				const offset =
					heading.getBoundingClientRect().top - container.getBoundingClientRect().top;
				if (offset < 200) found = sections[idx]?.id ?? null;
			}
			setActiveSection(found);
		}

		container.addEventListener("scroll", onScroll, { passive: true });
		onScroll();
		return () => container.removeEventListener("scroll", onScroll);
	}, [mode, sections, labels]);

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
		(event: React.KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key === "s") {
				event.preventDefault();
				if (isDirty) handleSave();
			}
		},
		[handleSave, isDirty],
	);

	if (mode === "read") {
		return (
			<div className="flex min-h-0 flex-1 flex-col">
				<RulerHeader
					title={title}
					description={description}
					progress={progress}
					sections={sections}
					activeSection={activeSection}
					actions={
						<Button size="sm" onClick={() => setMode("edit")}>
							<Icon name="edit" size={14} />
							Editar
						</Button>
					}
				/>
				<div
					ref={scrollRef}
					className="flex-1 overflow-y-auto bg-[var(--color-bg-base)] px-4 py-6 sm:px-6 lg:px-8"
				>
					<div className="mx-auto max-w-3xl rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-5 shadow-sm sm:px-7 sm:py-6">
						<Markdown content={content} />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
			<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-[var(--color-bg-surface)] px-4 py-3 lg:px-6">
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-2">
						<Icon
							name="edit"
							size={16}
							className="shrink-0 text-[var(--color-primary)]"
						/>
						<span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
							{title}
						</span>
					</div>
					<p className="mt-1 text-xs text-[var(--color-text-secondary)]">
						Edite o Markdown e revise a prévia antes de salvar.
					</p>
				</div>

				{isDirty ? (
					<span
						className="inline-flex items-center gap-1 rounded-[var(--radius-full)] border border-[color-mix(in_oklch,var(--color-warning)_42%,transparent)] px-2 py-1 text-caption font-medium text-[var(--color-warning)]"
						title="Alterações não salvas"
						role="status"
						aria-label="Alterações não salvas"
					>
						<span className="size-1.5 rounded-full bg-[var(--color-warning)]" />
						Alterações não salvas
					</span>
				) : null}

				<Button size="sm" onClick={handleSave} loading={saving} disabled={!isDirty}>
					<Icon name="check" size={14} />
					Salvar
				</Button>
				<Button size="sm" variant="ghost" onClick={handleCancel}>
					Cancelar
				</Button>
			</div>

			<div className="relative grid flex-1 grid-cols-1 overflow-y-auto lg:min-h-0 lg:grid-cols-2 lg:overflow-hidden">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 lg:px-6">
						<span className="text-caption font-medium uppercase text-[var(--color-text-secondary)]">
							Editor
						</span>
					</div>
					<Textarea
						aria-label="Conteúdo Markdown"
						value={content}
						onChange={(event) => setContent(event.target.value)}
						className="min-h-[42svh] flex-1 resize-none rounded-none border-none px-4 py-4 text-sm leading-relaxed outline-none lg:min-h-0 lg:px-6"
						style={{
							background: "var(--color-bg-base)",
							color: "var(--color-text-primary)",
							fontFamily: "var(--font-code)",
						}}
						spellCheck={false}
					/>
				</div>

				<div className="absolute inset-y-0 left-1/2 hidden w-px bg-[var(--color-border)] lg:block" />

				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="flex shrink-0 items-center gap-2 border-y border-border px-4 py-2 lg:border-b lg:border-t-0 lg:px-6">
						<span className="text-caption font-medium uppercase text-[var(--color-text-secondary)]">
							Preview
						</span>
					</div>
					<div className="min-h-[42svh] flex-1 overflow-y-auto bg-[var(--surface-1)] px-4 py-4 lg:min-h-0 lg:px-6">
						<div className="mx-auto max-w-3xl">
							<Markdown content={content} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
