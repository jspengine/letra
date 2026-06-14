import { useCallback, useEffect, useState } from "react";
import type { ResolvedSpec } from "@letra/types";
import { Badge, Button, Input, Textarea, Checkbox, Icon } from "@letra/ui";
import type { IconName } from "@letra/ui";
import { cn } from "../../lib/utils";
import { useToast } from "../Toast/Toast";
import { Markdown } from "../ui/markdown";

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
	return content
		.replace(/(# Spec:?)\s*.*/, `$1 ${name}`)
		.replace(/\{\{date\}\}/g, today);
}

export default function SpecsView() {
	const { toast } = useToast();
	const [specs, setSpecs] = useState<ResolvedSpec[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [editing, setEditing] = useState(false);
	const [editContent, setEditContent] = useState("");
	const [editName, setEditName] = useState("");
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");
	const [validations, setValidations] = useState<Map<string, SpecValidation>>(new Map());
	const load = useCallback(() => {
		fetch("/api/specs")
			.then((r) => r.json())
			.then((data) => {
				if (Array.isArray(data)) setSpecs(data);
			})
			.catch(() => {});
	}, []);

	useEffect(() => { load(); }, [load]);

	const selectedSpec = specs.find((s) => s.id === selected);

	function specDate(content: string): string {
		const m = content.match(/> Updated:\s*(\d{4}-\d{2}-\d{2})/);
		return m ? m[1] : "";
	}

	function formatSpecDate(dateStr: string): string {
		if (!dateStr) return "";
		const [y, mo, d] = dateStr.split("-");
		return `${d}/${mo}/${y}`;
	}

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
			case "errors": return v && !v.valid;
			case "warnings": return v && v.issues.some(i => i.type === "warning");
			case "valid": return v && v.valid;
			default: return true;
		}
	});

	function handleSelect(id: string) {
		setSelected(id);
		setEditing(false);
		setCreating(false);
	}

	function handleEdit(spec: ResolvedSpec) {
		setEditContent(spec.content);
		setEditName(spec.id);
		setEditing(true);
		setCreating(false);
	}

	function handleSave() {
		if (!selected) return;
		const content = updateSpecName(editContent, editName);
		fetch(`/api/specs/${selected}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		}).then(() => {
			setEditing(false);
			load();
			toast("Spec salva", "success");
		});
	}

	function handleDelete(id: string) {
		if (!window.confirm("Tem certeza que deseja excluir esta spec?")) return;
		fetch(`/api/specs/${id}`, { method: "DELETE" }).then(() => {
			if (selected === id) { setSelected(null); setEditing(false); }
			load();
			toast("Spec excluída", "success");
		});
	}

	function handleValidate(id: string) {
		fetch(`/api/specs/${id}/validate`, { method: "POST" })
			.then((r) => r.json())
			.then((data) => {
				setValidations((prev) => new Map(prev).set(id, data));
				const errorCount = data.issues.filter((i: any) => i.type === "error").length;
				if (errorCount === 0) {
					toast("Spec válida!", "success");
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
		}).then((r) => r.json()).then((data) => {
			if (data && !data.error) {
				setCreating(false);
				setNewName("");
				setSelected(name);
				setEditing(true);
				setEditContent(content);
				setEditName(name);
				load();
			}
		});
	}

	function handleACChange(checked: boolean, line: number) {
		if (!selected) return;
		const newContent = toggleAC(editContent, line, checked);
		setEditContent(newContent);
	}

	function filterCount(f: Filter): number {
		if (f === "all") return specs.length;
		return specs.filter((s) => {
			const v = validations.get(s.id);
			switch (f) {
				case "errors": return v && !v.valid;
				case "warnings": return v && v.issues.some(i => i.type === "warning");
				case "valid": return v && v.valid;
				default: return true;
			}
		}).length;
	}

	return (
		<div className="flex h-full">
			<div className="w-[30%] border-r overflow-y-auto flex flex-col shrink-0" style={{ borderColor: "var(--border)" }}>
				<div className="p-3 flex flex-col gap-2 border-b" style={{ borderColor: "var(--border)" }}>
					<div className="flex items-center gap-2">
						<h2 className="text-sm font-semibold flex-1">Specs</h2>
						<Button size="sm" variant="default" onClick={() => { setCreating(true); setEditing(false); setSelected(null); }}>
							+ Nova
						</Button>
					</div>
					<Input
						placeholder="Buscar specs..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						aria-label="Buscar specs"
					/>
					<div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
					{([
						{ id: "all" as Filter, label: "Todas", icon: null as IconName | null },
						{ id: "errors" as Filter, label: "Erros", icon: "x" as IconName },
						{ id: "warnings" as Filter, label: "Avisos", icon: "alert-triangle" as IconName },
						{ id: "valid" as Filter, label: "Válidas", icon: "check" as IconName },
					] as const).map((f, i) => {
						const active = filter === f.id;
						return (
							<button
								key={f.id}
								onClick={() => setFilter(f.id)}
								className={cn(
									"flex items-center justify-center gap-1 text-xs px-2.5 py-1.5 transition-colors flex-1",
									i > 0 && "border-l",
									active ? "font-medium" : "hover:bg-muted/50",
								)}
								style={{
									background: active ? "var(--primary)" : "transparent",
									color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
									borderColor: "var(--border)",
								}}
								title={
									f.id === "errors" ? "Specs com erro de validação" :
									f.id === "warnings" ? "Specs com avisos" :
									f.id === "valid" ? "Specs válidas" :
									"Todas as specs"
								}
							>
								{f.icon && (
									<Icon
										name={f.icon}
										size={14}
										style={{
											color: active ? "var(--primary-foreground)" :
												f.id === "errors" ? "var(--error)" :
												f.id === "warnings" ? "var(--warning)" :
												f.id === "valid" ? "var(--success)" : undefined,
										}}
									/>
								)}
								<span className="truncate">{f.label}</span>
								<span className="opacity-70">{filterCount(f.id)}</span>
							</button>
						);
					})}
				</div>
				</div>
				<div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
					{creating && (
						<div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
							<Input
								placeholder="Nome da spec (ex: auth-flow)"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								aria-label="Nome da nova spec"
								autoFocus
							/>
							<div className="flex gap-2 mt-2">
								<Button size="sm" onClick={handleCreate}>Criar</Button>
								<Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
							</div>
						</div>
					)}
					{filtered.map((spec) => {
						const v = validations.get(spec.id);
						const status = v ? (v.valid ? "valid" : "error") : null;
						const date = formatSpecDate(specDate(spec.content));
						return (
							<button
								key={spec.id}
								onClick={() => handleSelect(spec.id)}
								onContextMenu={(e) => { e.preventDefault(); handleValidate(spec.id); }}
								className="text-left px-3 py-2 rounded-lg hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors flex items-center gap-2"
								style={{
									background: selected === spec.id ? "var(--muted)" : undefined,
								}}
							>
								{status ? (
									<Icon
										name={status === "valid" ? "check" : "x"}
										size={14}
										style={{ color: status === "valid" ? "var(--success)" : "var(--error)" }}
									/>
								) : (
									<span className="w-3.5 inline-flex items-center justify-center text-xs" style={{ color: "var(--muted-foreground)" }}>○</span>
								)}
								<span className="text-sm truncate flex-1">{spec.id}</span>
								{v && v.issues.length > 0 && (
									<Badge variant={v.valid ? "success" : "warning"} className="shrink-0">
										{v.issues.filter(i => i.type === "error").length}E {v.issues.filter(i => i.type === "warning").length}W
									</Badge>
								)}
								<span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
									{date}
								</span>
							</button>
						);
					})}
					{filtered.length === 0 && !creating && (
						<p className="text-sm px-3 py-4 text-center" style={{ color: "var(--muted-foreground)" }}>
							{search ? "Nenhuma spec encontrada" : "Nenhuma spec ainda. Crie uma!"}
						</p>
					)}
				</div>
			</div>

			<div className="flex flex-col flex-1 min-w-0 h-full">
				{editing && selectedSpec ? (
					<div className="animate-fade-in flex flex-col gap-4 p-6 max-w-3xl mx-auto w-full">
						<div className="flex items-center gap-2">
							<Input
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								className="text-lg font-bold flex-1"
								aria-label="Nome da spec"
							/>
						</div>
						<div className="flex flex-col gap-2">
							{parseACs(editContent).map((ac) => (
								<Checkbox
									key={ac.line}
									checked={ac.checked}
									label={ac.text}
									onChange={(e) => handleACChange(e.target.checked, ac.line)}
								/>
							))}
						</div>
						<Textarea
							value={editContent}
							onChange={(e) => setEditContent(e.target.value)}
							className="min-h-[400px]"
							spellCheck={false}
						/>
						<div className="flex gap-2">
							<Button onClick={handleSave}>Salvar</Button>
							<Button variant="ghost" onClick={() => { setEditing(false); setEditContent(selectedSpec.content); }}>
								Cancelar
							</Button>
							<div className="flex-1" />
							<Button variant="outline" onClick={() => handleValidate(selected!)}>
								Validar
							</Button>
							<Button
								variant="outline"
								onClick={() => handleDelete(selected!)}
								style={{ color: "var(--error)" }}
							>
								Excluir
							</Button>
						</div>
						{validations.get(selected!) && (
							<div className="flex flex-col gap-1">
								{validations.get(selected!)!.issues.map((issue, i) => (
									<div
										key={i}
										className="text-sm px-3 py-2 rounded-lg"
										style={{
											background: "var(--muted)",
											color: issue.type === "error" ? "var(--error)" : "var(--warning)",
										}}
									>
										{issue.type === "error" ? "✗" : "⚠"} {issue.msg}
									</div>
								))}
								{validations.get(selected!)!.issues.length === 0 && (
									<div className="text-sm px-3 py-2 rounded-lg" style={{ color: "var(--success)" }}>
										✅ Spec válida
									</div>
								)}
							</div>
						)}
					</div>
				) : selectedSpec ? (
					<div key={selectedSpec.id} className="animate-fade-in flex flex-col h-full">
						<div className="flex items-center gap-2.5 px-6 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
							<Icon name="specs" size={20} className="text-primary" />
							<div className="flex-1 min-w-0">
								<h2 className="text-sm font-semibold truncate">{selectedSpec.id}</h2>
								<p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
									Spec de funcionalidade — define objetivo, constraints, critérios de aceitação e contexto.
								</p>
							</div>
							<Button size="sm" variant="outline" onClick={() => handleValidate(selectedSpec.id)}>
								Validar
							</Button>
							<Button size="sm" onClick={() => handleEdit(selectedSpec)}>
								Editar
							</Button>
						</div>
						<div className="flex-1 overflow-y-auto p-6">
							<div className="max-w-3xl mx-auto flex flex-col gap-4">
								{validations.get(selectedSpec.id) && (
									<div className="flex flex-wrap gap-2">
										{validations.get(selectedSpec.id)!.issues.map((issue, i) => (
											<Badge key={i} variant="warning">
												{issue.type === "error" ? "✗" : "⚠"} {issue.msg}
											</Badge>
										))}
										{validations.get(selectedSpec.id)!.issues.length === 0 && (
											<Badge variant="success">✅ Válida</Badge>
										)}
									</div>
								)}
								<div className="flex flex-col gap-2">
									{parseACs(selectedSpec.content).map((ac) => (
										<Checkbox
											key={ac.line}
											checked={ac.checked}
											label={ac.text}
											onChange={(e) => {
												const newContent = toggleAC(selectedSpec.content, ac.line, e.target.checked);
												setEditContent(newContent);
												fetch(`/api/specs/${selectedSpec.id}`, {
													method: "PUT",
													headers: { "Content-Type": "application/json" },
													body: JSON.stringify({ content: newContent }),
												}).then(() => load());
											}}
										/>
									))}
								</div>
								<Markdown content={selectedSpec.content} />
							</div>
						</div>
					</div>
				) : (
					<div className="flex items-center justify-center h-full">
						<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
							Selecione uma spec ou crie uma nova
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
