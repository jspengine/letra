import { useMemo, useState } from "react";
import { Badge, Button, Checkbox, Icon, Input, Textarea, useToast } from "@letra/ui";
import { cn } from "../../lib/utils";

interface Props {
	onComplete: (data: { name: string }) => void;
	onCancel: () => void;
	existingNames: string[];
}

interface AdapterProposal {
	tool: string;
	label: string;
	state: "detected" | "available";
	selected: boolean;
	evidence: string[];
}

interface LocationProposal {
	id: string;
	label: string;
	path: string;
	stack: string[];
	evidence: string[];
	adapters: AdapterProposal[];
}

interface SetupProposal {
	id: string;
	workspace: {
		name: string;
		root: string;
		harnessVersion: string;
	};
	locations?: LocationProposal[];
	warnings: string[];
}

interface SetupOperation {
	kind: "create" | "update" | "preserve" | "conflict";
	path: string;
	reason: string;
	tool?: string;
}

interface SetupPlan {
	proposalId: string;
	workspaceRoot: string;
	conflictCount: number;
	operations: SetupOperation[];
}

function targetAdapterKey(targetId: string, tool: string) {
	return `${targetId}:${tool}`;
}

function workspaceSlug(name: string) {
	return (name || "workspace")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "workspace";
}

function normalizePath(path: string) {
	return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export default function WorkspaceSetupFlow({ onComplete, onCancel, existingNames }: Props) {
	const { toast } = useToast();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [root, setRoot] = useState("");
	const [nameTouched, setNameTouched] = useState(false);
	const [proposal, setProposal] = useState<SetupProposal | null>(null);
	const [plan, setPlan] = useState<SetupPlan | null>(null);
	const [created, setCreated] = useState(false);
	const [selectedAdapters, setSelectedAdapters] = useState<Record<string, boolean>>({});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const duplicateName = existingNames.some((entry) => entry.toLowerCase() === name.trim().toLowerCase());
	const dataDir = `~/.letra/workspaces/${workspaceSlug(name.trim())}`;
	const nameError = !name.trim()
		? "Nome é obrigatório"
		: duplicateName
			? "Já existe um workspace com este nome"
			: "";
	const canAnalyze = !nameError && root.trim().length > 0 && !loading;
	const proposalLocations = useMemo(() => {
		if (!proposal) return [];
		return proposal.locations ?? [];
	}, [proposal]);

	const selectedLocations = useMemo(() => {
		return proposalLocations.map((loc) => ({
			id: loc.id,
			label: loc.label,
			path: loc.path,
			adapters: loc.adapters
				.filter((adapter) => selectedAdapters[targetAdapterKey(loc.id, adapter.tool)])
				.map((adapter) => adapter.tool),
		}));
	}, [proposalLocations, selectedAdapters]);
	const selectedTools = useMemo(
		() => [...new Set(selectedLocations.flatMap((loc) => loc.adapters))],
		[selectedLocations],
	);
	const governanceOperationCount = plan?.operations.filter((operation) => operation.path.endsWith("/workflow.json")).length ?? 0;
	const linkOperationCount = plan?.operations.filter((operation) => operation.path.endsWith("/.letra-link")).length ?? 0;
	const adapterOperationCount = plan?.operations.filter((operation) => !operation.path.endsWith("/workflow.json") && !operation.path.endsWith("/.letra-link")).length ?? 0;
	const selectedAdapterLocations = selectedLocations.filter((loc) => loc.adapters.length > 0);
	const canReview = !!proposal && selectedLocations.length > 0 && !loading;
	const canCreate = !!proposal && !!plan && plan.conflictCount === 0 && !loading;

	async function analyzeWorkspace() {
		if (!canAnalyze) return;
		setLoading(true);
		setError("");
		setPlan(null);
		setCreated(false);
		try {
			const res = await fetch("/api/workspace/setup/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim(), root: root.trim() }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Não foi possível analisar a pasta.");
			const nextProposal = data as SetupProposal;
			const nextSelected: Record<string, boolean> = {};
			const list = nextProposal.locations ?? [];
			for (const target of list) {
				for (const adapter of target.adapters) {
					nextSelected[targetAdapterKey(target.id, adapter.tool)] = adapter.selected;
				}
			}
			setProposal(nextProposal);
			setSelectedAdapters(nextSelected);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	async function reviewInstallation() {
		if (!proposal || selectedLocations.length === 0) return;
		setLoading(true);
		setError('');
		try {
			const res = await fetch('/api/workspace/setup/plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					proposalId: proposal.id,
					workspaceRoot: dataDir,
					dataDir,
					name: name.trim(),
					template: 'padrao',
					locations: selectedLocations,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Não foi possível revisar a instalação.');
			setPlan(data as SetupPlan);
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}
	async function confirmCreation() {
		if (!proposal || !plan || plan.conflictCount > 0) return;
		setLoading(true);
		setError("");
		try {
			const res = await fetch("/api/workflow/setup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					proposalId: proposal.id,
					name: name.trim(),
					description: description.trim(),
					workspacePath: dataDir,
					dataDir,
					directories: selectedLocations.map((loc) => loc.path),
					locations: selectedLocations,
					tools: selectedTools,
					template: "padrao",
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Não foi possível criar o workspace.");
			toast("Workspace criado com sucesso!", "success");
			setCreated(true);
			onComplete({ name: name.trim() });
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	function toggleAdapter(targetId: string, tool: string) {
		const key = targetAdapterKey(targetId, tool);
		setSelectedAdapters((prev) => ({ ...prev, [key]: !prev[key] }));
		setPlan(null);
		setCreated(false);
	}

	function selectedAdapterCount(target: LocationProposal) {
		return target.adapters.filter((adapter) => selectedAdapters[targetAdapterKey(target.id, adapter.tool)]).length;
	}

	function locationRole(target: LocationProposal) {
		const isSolutionRoot = normalizePath(target.path) === normalizePath(proposal?.workspace.root ?? "");
		if (isSolutionRoot) return "Raiz da solução";
		return selectedAdapterCount(target) > 0 ? "Pasta com adapters" : "Somente vínculo";
	}

	return (
		<div className="h-full overflow-y-auto p-6">
			<div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
				<section className="flex flex-col gap-6">
					<div className="flex items-start justify-between gap-4 sm:grid sm:grid-cols-[1fr_auto]">
						<div>
							<h1 className="text-2xl font-bold">Novo workspace</h1>
							<p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
								Crie a pasta de governança do Letra e vincule as pastas/projetos que ela deve acompanhar.
							</p>
						</div>
						<Button type="button" variant="ghost" onClick={onCancel}>
							Voltar para Meus Workspaces
						</Button>
					</div>

					<div className="grid gap-4 rounded-[var(--radius-md)] border p-4" style={{ borderColor: "var(--color-border)" }}>
						<div>
							<h2 className="text-lg font-semibold">Workspace e pastas/projetos</h2>
							<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
								Informe o nome do workspace e uma pasta de projeto inicial. Nada será escrito antes da confirmação final.
							</p>
						</div>
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">Nome do workspace</span>
							<Input
								value={name}
								onBlur={() => setNameTouched(true)}
								onChange={(event) => {
									setName(event.target.value);
									setProposal(null);
									setPlan(null);
									setCreated(false);
								}}
								placeholder="Ex: Portal de atendimento"
								aria-invalid={nameTouched && !!nameError}
							/>
							{nameTouched && nameError && (
								<span className="text-xs" style={{ color: "var(--color-danger)" }}>
									{nameError}
								</span>
							)}
						</label>
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">Descrição opcional</span>
							<Textarea
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder="Descreva o propósito deste workspace"
								rows={3}
							/>
						</label>
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">Data directory do workspace</span>
							<Input value={dataDir} readOnly aria-readonly="true" />
						</label>
						<label className="flex flex-col gap-1.5">
							<span className="text-sm font-medium">Pasta/projeto inicial</span>
							<Input
								value={root}
								onChange={(event) => {
									setRoot(event.target.value);
									setProposal(null);
									setPlan(null);
									setCreated(false);
								}}
								placeholder="C:/Workspace/meu-projeto"
							/>
						</label>
						<div className="flex flex-wrap items-center gap-3">
							<Button type="button" onClick={analyzeWorkspace} loading={loading} disabled={!canAnalyze}>
								<Icon name="search" size={14} />
								Analisar pasta/projeto
							</Button>
							<span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
								O harness fica fora do projeto; a pasta recebe apenas o vínculo.
							</span>
						</div>
					</div>

					<div className="flex flex-col gap-4 rounded-[var(--radius-md)] border p-4" style={{ borderColor: "var(--color-border)" }}>
						<div>
							<h2 className="text-lg font-semibold">Proposta do Letra</h2>
							<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
								Revise as pastas/projetos vinculadas ao workspace antes de gerar a prévia.
							</p>
						</div>
						{proposal ? (
							<>
								{proposal.warnings.map((warning) => (
									<div key={warning} className="rounded-[var(--radius-sm)] border p-3 text-sm" style={{ borderColor: "var(--color-border)" }}>
										{warning}
										<span className="mt-1 block text-xs" style={{ color: "var(--color-text-secondary)" }}>
											Adapters disponíveis aparecem nas opções avançadas e só serão escritos nas pastas onde forem marcados.
										</span>
									</div>
								))}
								<div className="flex flex-col gap-3">
									{proposalLocations.map((target) => (
										<div key={target.id} className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: "var(--color-border)" }}>
											<div className="flex flex-col gap-2">
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0">
														<div className="flex flex-wrap items-center gap-2">
															<h3 className="font-semibold">{target.label}</h3>
															<Badge variant="info" tone="soft">{locationRole(target)}</Badge>
														</div>
														<p className="truncate font-mono text-xs" style={{ color: "var(--color-text-secondary)" }}>
															{target.path}
														</p>
													</div>
													<Badge variant={selectedAdapterCount(target) > 0 ? "success" : "info"} tone="soft">
														{selectedAdapterCount(target) > 0 ? `${selectedAdapterCount(target)} adapter(s)` : "só .letra-link"}
													</Badge>
												</div>
												<div className="flex flex-wrap gap-2">
													{target.stack.map((stack) => (
														<Badge key={stack} variant="info" tone="soft">{stack}</Badge>
													))}
													{target.evidence.map((evidence) => (
														<Badge key={evidence} variant="info" tone="soft">{evidence}</Badge>
													))}
												</div>
												<details className="rounded-[var(--radius-sm)] border p-3" style={{ borderColor: "var(--color-border)" }}>
													<summary className="cursor-pointer text-sm font-medium">Opções avançadas</summary>
													<p className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
														Marque adapters apenas nas pastas onde o Letra deve criar instruções para agentes. Em geral, use a raiz Git/solução.
													</p>
													<div className="mt-3 grid gap-2 sm:grid-cols-2">
														{target.adapters.map((adapter) => (
															<div
																key={adapter.tool}
																className={cn(
																	"rounded-[var(--radius-sm)] border p-3",
																	selectedAdapters[targetAdapterKey(target.id, adapter.tool)] && "bg-[var(--color-primary-subtle)]",
																)}
																style={{ borderColor: "var(--color-border)" }}
															>
																<div className="flex items-start gap-3">
																	<Checkbox
																		aria-label={`${adapter.label} em ${target.label}`}
																		checked={!!selectedAdapters[targetAdapterKey(target.id, adapter.tool)]}
																		onChange={() => toggleAdapter(target.id, adapter.tool)}
																	/>
																	<div className="min-w-0">
																		<p className="text-sm font-medium">{adapter.label}</p>
																		<p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
																			{selectedAdapters[targetAdapterKey(target.id, adapter.tool)]
																				? `Será escrito em ${target.label}`
																				: `Disponível para ${target.label}`}
																		</p>
																	</div>
																</div>
																<div className="mt-2 flex flex-wrap gap-2">
																	<Badge variant={adapter.state === "detected" ? "success" : "info"} tone="soft">
																		{adapter.state === "detected" ? "detectado" : "disponível"}
																	</Badge>
																	{adapter.evidence.map((evidence) => (
																		<Badge key={evidence} variant="info" tone="soft">{evidence}</Badge>
																	))}
																</div>
															</div>
														))}
													</div>
												</details>
											</div>
										</div>
									))}
								</div>
								<div className="flex justify-end">
									<Button type="button" onClick={reviewInstallation} loading={loading} disabled={!canReview}>
										Gerar prévia de escrita
									</Button>
								</div>
							</>
						) : (
							<div className="rounded-[var(--radius-sm)] border p-4 text-sm" style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
								A proposta aparecerá aqui depois da análise da pasta/projeto inicial.
							</div>
						)}
					</div>

					{created && (
						<div className="flex flex-col items-center gap-4 rounded-[var(--radius-md)] border p-8 text-center" style={{ borderColor: "var(--color-border)" }}>
							<Icon name="check-circle" size={24} style={{ color: "var(--color-success)" }} />
							<div>
								<h2 className="text-xl font-semibold">Workspace criado!</h2>
								<p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
									O workspace {name.trim()} já pode ser supervisionado no Letra.
								</p>
							</div>
							<Button type="button" onClick={onCancel}>Ir para Meus Workspaces</Button>
						</div>
					)}

					{error && (
						<div className="rounded-[var(--radius-sm)] border p-3 text-sm" style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}>
							{error}
						</div>
					)}
				</section>

				<aside className="flex flex-col gap-4 rounded-[var(--radius-md)] border p-4" style={{ borderColor: "var(--color-border)" }}>
					<div>
						<h2 className="text-lg font-semibold">Prévia de escrita</h2>
						<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
							Confira os artefatos antes de criar o workspace.
						</p>
					</div>
					{proposal && plan ? (
						<>
							<div className="grid gap-2 rounded-[var(--radius-sm)] border p-3" style={{ borderColor: "var(--color-border)" }}>
								<p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Resumo</p>
								<p className="text-sm">
									{governanceOperationCount || 1} pasta de governança fora do projeto, {linkOperationCount} vínculo(s) .letra-link e {adapterOperationCount} arquivo(s) de adapter.
								</p>
								<p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
									Adapters serão escritos em {selectedAdapterLocations.length > 0 ? selectedAdapterLocations.map((loc) => loc.label).join(", ") : "nenhuma pasta"}.
								</p>
							</div>
							<div className="grid gap-3">
								<div className="rounded-[var(--radius-sm)] border p-3" style={{ borderColor: "var(--color-border)" }}>
									<p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>workflow.json</p>
									<p className="mt-1 text-sm">Criado em {dataDir}/workflow.json</p>
								</div>
								<div className="rounded-[var(--radius-sm)] border p-3" style={{ borderColor: "var(--color-border)" }}>
									<p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Vínculo</p>
									<p className="mt-1 text-sm">Cada pasta/projeto recebe apenas .letra-link apontando para o data directory.</p>
								</div>
								<div className="rounded-[var(--radius-sm)] border p-3" style={{ borderColor: "var(--color-border)" }}>
									<p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Adapters</p>
									<p className="mt-1 text-sm">{selectedTools.length > 0 ? selectedTools.join(", ") : "Nenhum adapter selecionado"}</p>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								{plan.operations.map((operation) => (
									<div key={`${operation.kind}:${operation.path}:${operation.tool || ""}`} className="rounded-[var(--radius-sm)] border p-3" style={{ borderColor: "var(--color-border)" }}>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="truncate font-mono text-xs">{operation.path}</p>
												<p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>{operation.reason}</p>
											</div>
											<Badge variant={operation.kind === "conflict" ? "error" : operation.kind === "preserve" ? "info" : "success"} tone="soft">
												{operation.kind}
											</Badge>
										</div>
									</div>
								))}
							</div>
							{plan.conflictCount > 0 && (
								<p className="text-sm" style={{ color: "var(--color-danger)" }}>
									Resolva os conflitos antes de criar o workspace.
								</p>
							)}
						</>
					) : (
						<div className="rounded-[var(--radius-sm)] border p-4 text-sm" style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
							Gere a prévia para ver exatamente quais arquivos serão criados, preservados ou bloqueados por conflito.
						</div>
					)}
					<Button type="button" onClick={confirmCreation} loading={loading} disabled={!canCreate}>
						Criar workspace
					</Button>
					<div className="flex flex-col gap-3">
						<h2 className="text-sm font-semibold">Checklist do cadastro</h2>
					{[
						["Analisar pasta", !!proposal],
						["Revisar proposta", !!plan],
						["Revisar opções avançadas", !!proposal],
						["Confirmar criação", created],
						["Validar workflow.json", created],
						["Validar .letra-link", created],
						["Validar pastas/projetos", created],
					].map(([label, done]) => (
						<div key={String(label)} className="flex items-center gap-2 text-sm">
							<Icon name={done ? "check" : "circle"} size={14} style={{ color: done ? "var(--color-success)" : "var(--color-text-secondary)" }} />
							<span>{label}</span>
						</div>
					))}
					</div>
					{proposal && (
						<div className="mt-2 rounded-[var(--radius-sm)] border p-3" style={{ borderColor: "var(--color-border)" }}>
							<p className="text-xs font-semibold uppercase" style={{ color: "var(--color-text-secondary)" }}>Pasta analisada</p>
							<p className="mt-1 truncate font-mono text-xs">{proposal.workspace.root}</p>
							<p className="mt-2 text-sm">{proposalLocations.length} pasta(s)/projeto(s) detectado(s)</p>
							<p className="text-sm">{selectedTools.length} adapter(s): {selectedTools.join(", ")}</p>
						</div>
					)}
				</aside>
			</div>
		</div>
	);
}
