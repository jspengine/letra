import { useEffect, useState } from "react";
import { Icon } from "@letra/ui";
import type { IconName } from "@letra/ui";
import { Markdown } from "../ui/markdown";
import { cn } from "../../lib/utils";
import { MarkdownView, extractMarkdownSections } from "../ui/MarkdownView";

type Tab = "context.md" | "constitution.md" | "glossary.md" | "decisions";

interface Decision {
	name: string;
	content: string;
}

const TABS: { id: Tab; label: string; icon: IconName }[] = [
	{ id: "context.md", label: "Context", icon: "context" },
	{ id: "constitution.md", label: "Constitution", icon: "star" },
	{ id: "glossary.md", label: "Glossary", icon: "search" },
	{ id: "decisions", label: "Decisions", icon: "list-three" },
];

const FILE_INFO: Record<string, { description: string }> = {
	"context.md": {
		description: "Visão geral do projeto — intent, domínio, stack, estado atual e restrições.",
	},
	"constitution.md": {
		description: "Regras fundamentais que todo agente deve seguir neste projeto.",
	},
	"glossary.md": {
		description: "Glossário de termos e definições para consistência na comunicação.",
	},
	decisions: {
		description: "Registro de Decisões Arquiteturais (ADRs) — escolhas e seus contextos.",
	},
};

function resolveTitle(content: string): string {
	const m = content.match(/^#\s+(.+)/m);
	return m ? m[1] : "";
}

function formatDate(name: string): string {
	const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
	if (m) {
		const [y, mo, d] = m[1].split("-");
		return `${d}/${mo}/${y}`;
	}
	return name.replace(/\.md$/, "").replace(/-/g, " ");
}

export default function ContextView() {
	const [tab, setTab] = useState<Tab>("context.md");
	const [content, setContent] = useState("");
	const [decisions, setDecisions] = useState<Decision[]>([]);
	const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		if (tab === "decisions") {
			fetch("/api/context?file=decisions")
				.then((r) => (r.ok ? r.json() : Promise.reject()))
				.then((data) => {
					if (Array.isArray(data)) setDecisions(data);
					setLoading(false);
				})
				.catch(() => {
					setDecisions([]);
					setLoading(false);
				});
			return;
		}

		fetch(`/api/context?file=${tab}`)
			.then((r) => (r.ok ? r.text() : Promise.reject()))
			.then((data) => {
				setContent(data || `# ${tab}\n\nEmpty file.`);
				setLoading(false);
			})
			.catch(() => {
				setContent(`# ${tab}\n\nFile not found or unable to load.`);
				setLoading(false);
			});
	}, [tab]);

	const selectedDecisionData = decisions.find((d) => d.name === selectedDecision);

	return (
		<div className="flex flex-1 min-h-0 overflow-hidden">
			<div
				className="w-72 border-r overflow-y-auto flex flex-col shrink-0"
				style={{ borderColor: "var(--border)" }}
			>
				<h2
					className="flex items-center gap-2 text-sm font-semibold px-4 py-3 border-b"
					style={{ borderColor: "var(--border)" }}
				>
					<Icon name="context" size={16} className="text-primary" />
					Context
				</h2>
				<div className="flex flex-col gap-0.5 p-2">
					{TABS.map((t) => (
						<button
							key={t.id}
							onClick={() => {
								setTab(t.id);
								setSelectedDecision(null);
							}}
							role="tab"
							aria-selected={tab === t.id}
							className={cn(
								"flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm",
								"transition-all duration-150",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
								"hover:bg-primary/5 active:scale-[0.97]",
								tab === t.id
									? "bg-primary/10 text-primary font-medium"
									: "hover:bg-muted/50",
							)}
						>
							<Icon
								name={t.icon}
								size={16}
								className={cn(
									"transition-colors duration-150",
									tab === t.id ? "text-primary" : "text-muted-foreground",
								)}
							/>
							{t.label}
						</button>
					))}
				</div>

				{tab === "decisions" && decisions.length > 0 && (
					<>
						<h3
							className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 uppercase tracking-wider"
							style={{ color: "var(--muted-foreground)" }}
						>
							<Icon name="list-three" size={14} />
							Decisões ({decisions.length})
						</h3>
						<div className="flex flex-col gap-0.5 px-2 pb-2">
							{decisions.map((d) => (
								<button
									key={d.name}
									onClick={() => setSelectedDecision(d.name)}
									className={cn(
										"flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm",
										"transition-all duration-150",
										"hover:bg-primary/5 active:scale-[0.97]",
										selectedDecision === d.name
											? "bg-primary/10 text-primary"
											: "hover:bg-muted/50",
									)}
								>
									<Icon
										name="chevron-right"
										size={14}
										className={cn(
											"transition-all duration-150",
											selectedDecision === d.name
												? "text-primary"
												: "text-muted-foreground",
										)}
									/>
									<div className="flex-1 min-w-0">
										<div
											className="text-xs"
											style={{ color: "var(--muted-foreground)" }}
										>
											{formatDate(d.name)}
										</div>
										<div className="truncate">
											{resolveTitle(d.content) || d.name}
										</div>
									</div>
								</button>
							))}
						</div>
					</>
				)}
			</div>

			<div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
				{loading ? (
					<div
						key={tab}
						className="animate-fade-in flex items-center justify-center h-full"
					>
						<p
							className="text-sm animate-pulse"
							style={{ color: "var(--muted-foreground)" }}
						>
							Loading...
						</p>
					</div>
				) : tab === "decisions" && selectedDecisionData ? (
					<MarkdownView
						key={`${tab}-${selectedDecision}`}
						title={
							resolveTitle(selectedDecisionData.content) || selectedDecisionData.name
						}
						description={FILE_INFO.decisions.description}
						sections={extractMarkdownSections(selectedDecisionData.content)}
					>
						<Markdown content={selectedDecisionData.content} />
					</MarkdownView>
				) : tab === "decisions" ? (
					<div
						key={tab}
						className="animate-fade-in flex items-center justify-center h-full"
					>
						<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
							Selecione uma decisão para visualizar
						</p>
					</div>
				) : (
					<MarkdownView
						key={tab}
						title={resolveTitle(content) || tab}
						description={FILE_INFO[tab]?.description}
						sections={extractMarkdownSections(content)}
					>
						<Markdown content={content} />
					</MarkdownView>
				)}
			</div>
		</div>
	);
}
