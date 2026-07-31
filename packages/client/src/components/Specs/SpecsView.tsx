import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResolvedSpec } from "@letra/types";
import {
	Badge,
	Button,
	ButtonGroup,
	ButtonGroupItem,
	Checkbox,
	DocumentEditor,
	Icon,
	Input,
	useToast,
} from "@letra/ui";
import { cn } from "../../lib/utils";
import { translateTerm } from "../../lib/term-translations";

type Filter = "all" | "errors" | "warnings" | "valid";

interface SpecValidation {
	id: string;
	issues: Array<{ type: "error" | "warning"; msg: string }>;
	valid: boolean;
}

const SPEC_TEMPLATE = `# Spec: {{name}}

> Updated: {{date}}

## Outcome

O que o usuário consegue fazer quando isso estiver pronto.

## Constraints

- Limitação técnica ou de negócio

## Exclusions

O que explicitamente NÃO está neste escopo.

## Acceptance Criteria

- [ ] **Critério 1**: Descrição binária (passa/falha).
- [ ] **Critério 2**: Descrição binária (passa/falha).

## Context

Por que estamos construindo isso. Trade-offs considerados. Decisões anteriores relevantes.
`;

function parseACs(content: string): Array<{ text: string; checked: boolean; line: number }> {
	const lines = content.split("\n");
	const acs: Array<{ text: string; checked: boolean; line: number }> = [];
	let inAC = false;
	lines.forEach((line, i) => {
		if (/^## Acceptance Criteria/.test(line)) inAC = true;
		else if (/^## /.test(line) && inAC) inAC = false;
		else if (inAC) {
			const m = line.match(/^\s*-\s+\[(\s|x)\]\s+(.+)/i);
			if (m) {
				acs.push({ text: m[2], checked: m[1].toLowerCase() === "x", line: i });
			}
		}
	});
	return acs;
}

function extractOutcome(content: string): string {
	const m = content.match(/## Outcome\s+([\s\S]*?)(?=\n## |$)/);
	if (!m) return "";
	return m[1].replace(/\*\*/g, "").replace(/\n+/g, " ").trim();
}

function validateSpecLocally(content: string): SpecValidation {
	const issues: Array<{ type: "error" | "warning"; msg: string }> = [];
	const requiredSections = [
		"Outcome",
		"Constraints",
		"Exclusions",
		"Acceptance Criteria",
		"Context",
	];
	for (const section of requiredSections) {
		if (!new RegExp(`## ${section}`).test(content)) {
			issues.push({ type: "error", msg: `Seção obrigatória ausente: ## ${section}` });
		}
	}
	const acMatch = content.match(/## Acceptance Criteria\s+([\s\S]*?)(?=\n## |$)/);
	if (acMatch) {
		const items = [...acMatch[1].matchAll(/-\s+\[(\s|x)\]\s+/g)];
		if (items.length === 0) {
			issues.push({ type: "warning", msg: "Critérios de aceite sem itens de checklist" });
		}
	}
	if (content.length > 3000) {
		issues.push({ type: "warning", msg: "Especificação excede 3000 caracteres; considere manter enxuta" });
	}
	return { id: "", issues, valid: issues.filter((i) => i.type === "error").length === 0 };
}

function toggleAC(content: string, line: number, checked: boolean): string {
	const lines = content.split("\n");
	const l = lines[line];
	const m = l.match(/^(\s*-\s+\[)(\s|x)(\]\s+.*)/i);
	if (m) {
		lines[line] = `${m[1]}${checked ? "x" : " "}${m[3]}`;
	}
	return lines.join("\n");
}

function updateSpecName(content: string, name: string): string {
	const today = new Date().toISOString().split("T")[0];
	return content.replace(/(# Spec:?)\s*.*/, `$1 ${name}`).replace(/\{\{date\}\}/g, today);
}

function specDate(content: string): string {
	const m = content.match(/> Updated:\s*(\d{4}-\d{2}-\d{2})/);
	return m ? m[1] : "";
}

function formatSpecDate(dateStr: string): string {
	if (!dateStr) return "";
	const [y, mo, d] = dateStr.split("-");
	return `${d}/${mo}/${y}`;
}

function validationTone(validation?: SpecValidation): "danger" | "warning" | "success" | "neutral" {
	if (!validation) return "neutral";
	if (!validation.valid) return "danger";
	if (validation.issues.some((issue) => issue.type === "warning")) return "warning";
	return "success";
}

function SpecStatusIcon({ tone }: { tone: ReturnType<typeof validationTone> }) {
	if (tone === "danger") return <Icon name="x" size={14} className="text-[var(--color-danger)]" />;
	if (tone === "warning") return <Icon name="alert-triangle" size={14} className="text-[var(--color-warning)]" />;
	if (tone === "success") return <Icon name="check" size={14} className="text-[var(--color-success)]" />;
	return <Icon name="circle" size={14} className="text-[var(--color-text-secondary)]" />;
}

function SpecListItem({
	spec,
	selected,
	validation,
	onSelect,
	onValidate,
}: {
	spec: ResolvedSpec;
	selected: boolean;
	validation?: SpecValidation;
	onSelect: () => void;
	onValidate: () => void;
}) {
	const tone = validationTone(validation);
	const outcome = extractOutcome(spec.content);
	const date = formatSpecDate(specDate(spec.content));
	const errorCount = validation?.issues.filter((issue) => issue.type === "error").length ?? 0;
	const warningCount = validation?.issues.filter((issue) => issue.type === "warning").length ?? 0;

	return (
		<Button
			type="button"
			variant="ghost"
			onClick={onSelect}
			onContextMenu={(event) => {
				event.preventDefault();
				onValidate();
			}}
			aria-pressed={selected}
			className={cn(
				"h-auto w-full justify-start rounded-[var(--radius-sm)] border border-transparent px-3 py-3 text-left",
				"hover:border-[var(--color-border)] hover:bg-[var(--surface-hover)]",
				selected && "border-[var(--color-border)] bg-[var(--surface-selected)] shadow-sm",
			)}
		>
			<span className="grid min-w-0 flex-1 gap-2">
				<span className="flex min-w-0 items-start gap-2">
					<span className="mt-0.5 shrink-0">
						<SpecStatusIcon tone={tone} />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
							{spec.id}
						</span>
						{outcome ? (
							<span className="mt-1 line-clamp-2 block text-xs font-normal leading-snug text-[var(--color-text-secondary)]">
								{outcome}
							</span>
						) : null}
					</span>
				</span>

				<span className="flex flex-wrap items-center gap-1.5 pl-6">
					{validation && validation.issues.length > 0 ? (
						<Badge variant={validation.valid ? "amber" : "error"} tone="soft">
							{errorCount} erros · {warningCount} avisos
						</Badge>
					) : validation ? (
						<Badge variant="success">Válida</Badge>
					) : (
						<Badge variant="info" tone="outline">Não validada</Badge>
					)}
					{date ? (
						<span className="text-caption tabular-nums text-[var(--color-text-secondary)]">
							{date}
						</span>
					) : null}
				</span>
			</span>
		</Button>
	);
}

export default function SpecsView() {
	const { toast } = useToast();
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [validations, setValidations] = useState<Map<string, SpecValidation>>(new Map());
	const validatedRef = useRef<Set<string>>(new Set());

	const load = useCallback(() => {
		fetch("/api/specs")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setSpecs(data);
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	useEffect(() => {
		if (specs.length === 0) return;
		const newValidations = new Map(validations);
		let changed = false;
		for (const s of specs) {
			if (!validatedRef.current.has(s.id)) {
				const validation = validateSpecLocally(s.content);
				validation.id = s.id;
				newValidations.set(s.id, validation);
				validatedRef.current.add(s.id);
				changed = true;
			}
		}
		if (changed) setValidations(newValidations);
		if (!selected && !creating) {
			setSelected(specs[0].id);
		}
	}, [specs, selected, creating, validations]);

	const selectedSpec = specs.find((s) => s.id === selected);
	const selectedAcs = useMemo(
		() => (selectedSpec ? parseACs(selectedSpec.content) : []),
		[selectedSpec],
	);
	const completedAcs = selectedAcs.filter((ac) => ac.checked).length;

	const sorted = [...specs].sort((a, b) => {
		const da = specDate(a.content);
		const db = specDate(b.content);
		if (!da && !db) return a.id.localeCompare(b.id);
		if (!da) return 1;
		if (!db) return -1;
		return db.localeCompare(da);
	});

	const filtered = sorted.filter((s) => {
		if (search) {
			const q = search.toLowerCase();
			if (!s.id.toLowerCase().includes(q) && !s.content.toLowerCase().includes(q)) return false;
		}
		const v = validations.get(s.id);
		switch (filter) {
			case "errors":
				return v && !v.valid;
			case "warnings":
				return v?.issues.some((i) => i.type === "warning");
			case "valid":
				return v?.valid;
			default:
				return true;
		}
	});

	function handleSelect(id: string) {
		setSelected(id);
		setCreating(false);
	}

	function handleValidate(id: string) {
		fetch(`/api/specs/${id}/validate`, { method: "POST" })
			.then((r) => r.json())
			.then((data) => {
				setValidations((prev) => new Map(prev).set(id, data));
				const errorCount = data.issues.filter((i: { type: string }) => i.type === "error").length;
				if (errorCount === 0) {
					toast("Spec válida", "success");
				} else {
					toast(`${errorCount} erro(s) encontrado(s)`, "error");
				}
			});
	}

	function handleCreate() {
		if (!newName.trim()) return;
		const name = newName.trim().toLowerCase().replace(/\s+/g, "-");
		const content = updateSpecName(SPEC_TEMPLATE, name);
		fetch("/api/specs", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id: name, content }),
		})
			.then((r) => r.json())
			.then((data) => {
				if (data && !data.error) {
					setCreating(false);
					setNewName("");
					setSelected(name);
					load();
				}
			});
	}

	function filterCount(f: Filter): number {
		if (f === "all") return specs.length;
		return specs.filter((s) => {
			const v = validations.get(s.id);
			switch (f) {
				case "errors":
					return v && !v.valid;
				case "warnings":
					return v?.issues.some((i) => i.type === "warning");
				case "valid":
					return v?.valid;
				default:
					return true;
			}
		}).length;
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
			<aside className="app-surface-panel flex max-h-[46svh] w-full shrink-0 flex-col overflow-hidden border-b border-l-0 border-r-0 border-t-0 lg:max-h-none lg:w-[24rem] lg:border-b-0 lg:border-r">
				<div className="grid shrink-0 gap-3 border-b border-border p-4">
					<div className="flex items-center gap-2">
						<div className="min-w-0 flex-1">
							<h2 className="text-sm font-semibold">Especificações</h2>
							<p className="text-xs text-[var(--color-text-secondary)]">
								Outcomes, constraints e critérios aprovados.
							</p>
						</div>
						<Button
							size="sm"
							variant="secondary"
							onClick={() => {
								setCreating(true);
								setSelected(null);
							}}
						>
							<Icon name="plus" size={14} />
							Nova
						</Button>
					</div>

					<Input
						placeholder="Buscar especificações..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						aria-label="Buscar especificações"
					/>

					<div className="overflow-x-auto">
						<ButtonGroup ariaLabel="Filtrar especificações" className="w-max flex-nowrap lg:w-full">
							{(
								[
									{ id: "all" as Filter, label: "Todas" },
									{ id: "errors" as Filter, label: "Erros" },
									{ id: "warnings" as Filter, label: "Avisos" },
									{ id: "valid" as Filter, label: "Válidas" },
								] as const
							).map((f) => (
								<ButtonGroupItem
									key={f.id}
									selected={filter === f.id}
									count={filterCount(f.id)}
									onClick={() => setFilter(f.id)}
									className="justify-center lg:flex-1"
									title={
										f.id === "errors"
											? "Especificações com erro de validação"
											: f.id === "warnings"
												? "Especificações com avisos"
												: f.id === "valid"
													? "Especificações válidas"
													: "Todas as especificações"
									}
								>
									{f.label}
								</ButtonGroupItem>
							))}
						</ButtonGroup>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto p-2">
					{creating ? (
						<div className="mb-2 grid gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
							<Input
								placeholder="Nome da especificação (ex: fluxo-de-autenticacao)"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								aria-label="Nome da nova especificação"
								autoFocus
							/>
							<div className="flex gap-2">
								<Button size="sm" onClick={handleCreate}>
									Criar
								</Button>
								<Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
									Cancelar
								</Button>
							</div>
						</div>
					) : null}

					<div className="grid gap-1">
						{filtered.map((spec) => (
							<SpecListItem
								key={spec.id}
								spec={spec}
								selected={selected === spec.id}
								validation={validations.get(spec.id)}
								onSelect={() => handleSelect(spec.id)}
								onValidate={() => handleValidate(spec.id)}
							/>
						))}
					</div>

					{filtered.length === 0 && !creating ? (
						<p className="px-3 py-4 text-center text-sm text-[var(--color-text-secondary)]">
							{search ? "Nenhuma especificação encontrada." : "Nenhuma especificação registrada."}
						</p>
					) : null}
				</div>
			</aside>

			<section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				{selectedSpec ? (
					<>
						<div className="grid shrink-0 gap-3 border-b border-border px-4 py-3 lg:px-6">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="info" tone="outline">{selectedAcs.length} critérios</Badge>
								<Badge variant={completedAcs === selectedAcs.length && selectedAcs.length > 0 ? "success" : "amber"}>
									{completedAcs}/{selectedAcs.length} concluídos
								</Badge>
								<Button size="sm" variant="secondary" onClick={() => handleValidate(selectedSpec.id)}>
									<Icon name="check" size={14} />
									Validar
								</Button>
							</div>

							{validations.get(selectedSpec.id) ? (
								<div className="flex flex-wrap gap-2">
									{validations.get(selectedSpec.id)?.issues.map((issue, i) => (
										<Badge key={`${issue.msg}-${i}`} variant={issue.type === "error" ? "error" : "amber"} tone="soft">
											{issue.type === "error" ? "Erro" : "Aviso"} · {issue.msg}
										</Badge>
									))}
									{validations.get(selectedSpec.id)?.issues.length === 0 ? (
										<Badge variant="success">Especificação válida</Badge>
									) : null}
								</div>
							) : null}

							{selectedAcs.length > 0 ? (
								<div className="grid max-h-40 gap-2 overflow-y-auto pr-1">
									{selectedAcs.map((ac) => (
										<Checkbox
											key={ac.line}
											checked={ac.checked}
											label={ac.text}
											onChange={(e) => {
												const newContent = toggleAC(
													selectedSpec.content,
													ac.line,
													e.target.checked,
												);
												fetch(`/api/specs/${selectedSpec.id}`, {
													method: "PUT",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({ content: newContent }),
												}).then(() => load());
											}}
										/>
									))}
								</div>
							) : null}
						</div>

						<DocumentEditor
							key={selectedSpec.id}
							file={selectedSpec.id}
							initialContent={selectedSpec.content}
							onSave={async (newContent) => {
								const content = updateSpecName(newContent, selectedSpec.id);
								await fetch(`/api/specs/${selectedSpec.id}`, {
									method: "PUT",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({ content }),
								});
								load();
							}}
							title={selectedSpec.id}
							description="Especificação de funcionalidade: define objetivo, restrições, critérios de aceite e contexto."
						/>
					</>
				) : (
					<div className="flex flex-1 items-center justify-center p-6 text-center">
						<p className="text-sm text-[var(--color-text-secondary)]">
							Selecione uma especificação ou crie uma nova.
						</p>
					</div>
				)}
			</section>
		</div>
	);
}
