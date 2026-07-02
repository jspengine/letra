import { useState, useEffect } from "react";
import { Button, Icon, Card, CardContent, EmptyState } from "@letra/ui";
import WorkspaceSetupFlow from "./WorkspaceSetupFlow";

export interface WorkspaceData {
	id: string;
	name: string;
	description?: string;
	slug: string;
	root?: string;
	createdAt: string;
	directories?: string[];
	tools?: string[];
	template?: string;
}

interface Props {
	onSelect?: (ws: WorkspaceData) => void;
	activeSlug?: string;
	gateMode?: boolean;
	activeDirectory?: string | null;
}

function formatDate(iso: string) {
	try {
		return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
	} catch {
		return iso;
	}
}

export default function WorkspacesView({ onSelect, activeSlug, gateMode, activeDirectory }: Props) {
	const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
	const [creating, setCreating] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/workspaces")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setWorkspaces(data);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	function handleCreate(data: { name: string }) {
		setWorkspaces((prev) => [...prev, { id: crypto.randomUUID?.() || `${Date.now()}`, name: data.name, slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), createdAt: new Date().toISOString() }]);
		setCreating(false);
	}

	if (creating) {
		return (
			<WorkspaceSetupFlow
				onComplete={(data) => {
					handleCreate(data);
					if (onSelect) {
						fetch("/api/workspaces")
							.then((r) => r.json())
							.then((list) => {
								if (Array.isArray(list) && list.length > 0) {
									const latest = list[list.length - 1];
									onSelect(latest);
								}
							})
							.catch(() => {});
					}
				}}
				onCancel={() => setCreating(false)}
				existingNames={workspaces.map((w) => w.name)}
			/>
		);
	}

	return (
		<div className="flex flex-col flex-1 p-6 gap-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Meus Workspaces</h1>
					<p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
						{gateMode ? "Selecione ou crie um workspace para começar" : "Gerencie seus espaços de trabalho"}
					</p>
				</div>
				<Button onClick={() => setCreating(true)}>
					<Icon name="plus" size={16} className="mr-1" />
					{gateMode ? "Criar novo workspace" : "Novo Workspace"}
				</Button>
			</div>

			{loading ? (
				<div className="flex-1 flex items-center justify-center">
					<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Carregando...</p>
				</div>
			) : workspaces.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<EmptyState
						icon={<Icon name="box" size={24} />}
						title="Nenhum workspace encontrado"
						description="Crie seu primeiro workspace para organizar seus projetos e começar a trabalhar."
						action={
							<Button onClick={() => setCreating(true)}>
								Crie agora seu workspace
							</Button>
						}
					/>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
					{workspaces.map((ws) => (
						<Card
							key={ws.id}
							className={`transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${onSelect ? "cursor-pointer" : ""} ${activeSlug === ws.slug ? "ring-2 ring-primary" : ""}`}
							onClick={() => onSelect?.(ws)}
						>
							<CardContent className="p-4 flex flex-col gap-3">
								<div className="flex items-start gap-2 min-w-0">
									<div
										className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
										style={{ background: activeSlug === ws.slug ? "var(--primary)" : "var(--muted)", color: activeSlug === ws.slug ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
									>
										<Icon name={activeSlug === ws.slug ? "check" : "box"} size={16} />
									</div>
									<div className="min-w-0">
										<h3 className="text-sm font-semibold truncate">{ws.name}</h3>
										{ws.description && (
											<p className="text-xs mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{ws.description}</p>
										)}
										<span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
											Criado em {formatDate(ws.createdAt)}
										</span>
									</div>
								</div>
								{ws.directories && ws.directories.length > 0 && (
									<div className="flex flex-col gap-1 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
										<span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--muted-foreground)" }}>
											Pastas gerenciadas
										</span>
										{ws.directories.map((dir) => {
											const isActive = activeSlug === ws.slug && activeDirectory === dir;
											const label = dir.split(/[/\\]/).pop() || dir;
											return (
												<div key={dir} className="flex items-center gap-1.5 text-xs" style={{ color: isActive ? "var(--primary)" : "var(--muted-foreground)" }}>
													<Icon name={isActive ? "check" : "folder"} size={12} />
													<span className="truncate">{label}</span>
												</div>
											);
										})}
									</div>
								)}
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
