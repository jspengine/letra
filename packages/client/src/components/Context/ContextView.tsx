import { useEffect, useState } from "react";
import { Button, DocumentEditor, Icon } from "@letra/ui";
import type { IconName } from "@letra/ui";
import { cn } from "../../lib/utils";
import HarnessViewer from "../Harness/HarnessViewer";
import RolesViewer from "./RolesViewer";
import SpecsView from "../Specs/SpecsView";

export type KnowledgeTab =
	| "context.md"
	| "constitution.md"
	| "glossary.md"
	| "decisions"
	| "specs"
	| "harness"
	| "roles";

interface Props {
	initialTab?: KnowledgeTab;
}

interface Decision {
	name: string;
	content: string;
}

interface KnowledgeSource {
	id: KnowledgeTab;
	label: string;
	description: string;
	icon: IconName;
}

const SOURCE_GROUPS: { title: string; sources: KnowledgeSource[] }[] = [
	{
		title: "Verdade do workspace",
		sources: [
			{
				id: "context.md",
				label: "Contexto do workspace",
				description: "Propósito, estado atual, domínio e restrições em vigor.",
				icon: "context",
			},
			{
				id: "glossary.md",
				label: "Glossário",
				description: "Linguagem comum para decisões, specs e comunicação.",
				icon: "search",
			},
			{
				id: "decisions",
				label: "Decisões",
				description: "Registro de escolhas relevantes e seus motivos.",
				icon: "list-three",
			},
		],
	},
	{
		title: "Regras de governança",
		sources: [
			{
				id: "constitution.md",
				label: "Constituição",
				description: "Regras não negociáveis de produto, arquitetura e workflow.",
				icon: "star",
			},
			{
				id: "harness",
				label: "Harness",
				description: "Autoridade versionada que define fluxos, gates e agentes.",
				icon: "cpu",
			},
			{
				id: "roles",
				label: "Papéis",
				description: "Quem são os agentes e suas capacidades no fluxo.",
				icon: "user",
			},
		],
	},
	{
		title: "Trabalho especificado",
		sources: [
			{
				id: "specs",
				label: "Especificações",
				description: "Outcomes, constraints e critérios de aceite aprovados.",
				icon: "specs",
			},
		],
	},
];

const FILE_INFO: Record<string, { description: string }> = {
	"context.md": {
		description:
			"Fonte de verdade operacional do workspace: propósito, domínio, estado atual e restrições.",
	},
	"constitution.md": {
		description:
			"Regras fundamentais que governam decisões, implementação, supervisão humana e regressão.",
	},
	"glossary.md": {
		description: "Termos e definições para manter a linguagem do produto consistente.",
	},
	decisions: {
		description: "Registro de decisões e seus contextos operacionais.",
	},
	specs: {
		description: "Especificações ativas do workspace e seus critérios de aceite.",
	},
	harness: {
		description: "Autoridade versionada que define como o workspace deve operar.",
	},
	roles: {
		description: "Agentes disponíveis no fluxo e suas capacidades.",
	},
};

function resolveTitle(content: string): string {
	const match = content.match(/^#\s+(.+)/m);
	return match ? match[1] : "";
}

function formatDate(name: string): string {
	const match = name.match(/^(\d{4}-\d{2}-\d{2})/);
	if (match) {
		const [year, month, day] = match[1].split("-");
		return `${day}/${month}/${year}`;
	}
	return name.replace(/\.md$/, "").replace(/-/g, " ");
}

function KnowledgeSourceButton({
	entry,
	selected,
	onSelect,
}: {
	entry: KnowledgeSource;
	selected: boolean;
	onSelect: () => void;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			onClick={onSelect}
			role="tab"
			aria-selected={selected}
			className={cn(
				"h-auto min-w-[15rem] flex-1 items-start justify-start gap-2.5 rounded-[var(--radius-sm)] border border-transparent px-3 py-2.5 text-left md:min-w-0",
				"hover:border-[var(--color-border)] hover:bg-[var(--surface-hover)]",
				selected &&
					"border-[var(--color-border)] bg-[var(--surface-selected)] text-[var(--color-primary)] shadow-sm",
			)}
		>
			<Icon
				name={entry.icon}
				size={16}
				className={cn(
					"mt-0.5 shrink-0",
					selected ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]",
				)}
			/>
			<span className="min-w-0">
				<span className="block text-sm font-medium leading-tight">{entry.label}</span>
				<span
					className={cn(
						"mt-1 line-clamp-2 block text-xs font-normal leading-snug",
						selected
							? "text-[var(--color-primary)]"
							: "text-[var(--color-text-secondary)]",
					)}
				>
					{entry.description}
				</span>
			</span>
		</Button>
	);
}

export default function ContextView({ initialTab = "context.md" }: Props) {
	const [tab, setTab] = useState<KnowledgeTab>(initialTab);
	const [content, setContent] = useState("");
	const [decisions, setDecisions] = useState<Decision[]>([]);
	const [selectedDecision, setSelectedDecision] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setTab(initialTab);
		setSelectedDecision(null);
	}, [initialTab]);

	useEffect(() => {
		setLoading(true);

		if (tab === "specs" || tab === "harness" || tab === "roles") {
			setLoading(false);
			return;
		}

		if (tab === "decisions") {
			fetch("/api/context?file=decisions")
				.then((response) => (response.ok ? response.json() : Promise.reject()))
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
			.then((response) => (response.ok ? response.text() : Promise.reject()))
			.then((data) => {
				setContent(data || `# ${tab}\n\nArquivo vazio.`);
				setLoading(false);
			})
			.catch(() => {
				setContent(`# ${tab}\n\nArquivo não encontrado ou indisponível.`);
				setLoading(false);
			});
	}, [tab]);

	const selectedDecisionData = decisions.find((decision) => decision.name === selectedDecision);

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
			<aside className="app-surface-panel flex max-h-[42svh] w-full shrink-0 flex-col overflow-hidden border-b border-l-0 border-r-0 border-t-0 md:max-h-none md:w-80 md:border-b-0 md:border-r">
				<div className="shrink-0 border-b border-border px-4 py-4">
					<h1 className="flex items-center gap-2 text-sm font-semibold">
						<Icon name="book" size={16} className="text-[var(--color-primary)]" />
						Biblioteca de governança
					</h1>
					<p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
						Contexto, regras e specs que explicam o que pode ser feito e por quê.
					</p>
				</div>

				<div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden p-3 md:flex-col md:gap-4 md:overflow-x-hidden md:overflow-y-auto">
				{SOURCE_GROUPS.map((group) => (
					<section
						key={group.title}
						className="flex min-w-[17rem] flex-col gap-1 md:min-w-0"
					>
						<h3 className="px-1 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
							{group.title}
						</h3>
						<div role="tablist" aria-label={group.title}>
							{group.sources.map((entry) => (
								<KnowledgeSourceButton
									key={entry.id}
									entry={entry}
									selected={tab === entry.id}
									onSelect={() => {
										setTab(entry.id);
										setSelectedDecision(null);
									}}
								/>
							))}
						</div>
					</section>
				))}
				</div>

				{tab === "decisions" && decisions.length > 0 ? (
					<div className="shrink-0 border-t border-border">
						<h3 className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase text-[var(--color-text-secondary)]">
							<Icon name="list-three" size={14} />
							Decisões ({decisions.length})
						</h3>
						<div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto px-2 pb-2 md:max-h-64">
							{decisions.map((decision) => (
								<Button
									key={decision.name}
									type="button"
									variant="ghost"
									onClick={() => setSelectedDecision(decision.name)}
									className={cn(
										"h-auto w-full justify-start gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm",
										"hover:bg-[var(--surface-hover)]",
										selectedDecision === decision.name &&
											"bg-[var(--surface-selected)] text-[var(--color-primary)]",
									)}
								>
									<Icon
										name="chevron-right"
										size={14}
										className={cn(
											"shrink-0",
											selectedDecision === decision.name
												? "text-[var(--color-primary)]"
												: "text-[var(--color-text-secondary)]",
										)}
									/>
									<span className="min-w-0 flex-1">
										<span className="block text-xs text-[var(--color-text-secondary)]">
											{formatDate(decision.name)}
										</span>
										<span className="block truncate">
											{resolveTitle(decision.content) || decision.name}
										</span>
									</span>
								</Button>
							))}
						</div>
					</div>
				) : null}
			</aside>

			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				{loading ? (
					<div className="flex h-full animate-fade-in items-center justify-center">
						<p className="animate-pulse text-sm text-[var(--color-text-secondary)]">
							Carregando...
						</p>
					</div>
				) : tab === "harness" ? (
					<HarnessViewer />
				) : tab === "roles" ? (
					<RolesViewer />
				) : tab === "specs" ? (
					<SpecsView />
				) : tab === "decisions" && selectedDecisionData ? (
					<DocumentEditor
						key={`${tab}-${selectedDecision}`}
						file={`decisions/${selectedDecisionData.name}`}
						initialContent={selectedDecisionData.content}
						onSave={async (newContent) => {
							await fetch(
								`/api/context?file=decisions/${selectedDecisionData.name}`,
								{
									method: "PUT",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ content: newContent }),
								},
							);
							const response = await fetch("/api/context?file=decisions");
							const data = await response.json();
							if (Array.isArray(data)) setDecisions(data);
						}}
						title={
							resolveTitle(selectedDecisionData.content) || selectedDecisionData.name
						}
						description={FILE_INFO.decisions.description}
					/>
				) : tab === "decisions" ? (
					<div className="flex h-full animate-fade-in items-center justify-center p-6 text-center">
						<p className="text-sm text-[var(--color-text-secondary)]">
							Selecione uma decisão para visualizar.
						</p>
					</div>
				) : (
					<DocumentEditor
						key={tab}
						file={tab}
						initialContent={content}
						onSave={async (newContent) => {
							await fetch(`/api/context?file=${tab}`, {
								method: "PATCH",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({ content: newContent }),
							});
						}}
						title={resolveTitle(content) || tab}
						description={FILE_INFO[tab]?.description}
					/>
				)}
			</div>
		</div>
	);
}
