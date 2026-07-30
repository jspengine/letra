import { useState } from "react";
import {
	Button,
	Badge,
	Card,
	CardContent,
	Icon,
	Input,
	Textarea,
	Checkbox,
	Alert,
	Progress,
	Tabs,
	Tooltip,
	Avatar,
	EmptyState,
} from "@letra/ui";
import type { IconName } from "@letra/ui";

type Section =
	| "todas"
	| "tokens"
	| "button"
	| "badge"
	| "card"
	| "icon"
	| "form"
	| "feedback"
	| "layout";

const ICON_NAMES: IconName[] = [
	"home",
	"specs",
	"flow",
	"context",
	"sun",
	"moon",
	"grid",
	"plus",
	"trash",
	"check",
	"edit",
	"search",
	"info",
	"chevron-left",
	"chevron-right",
	"arrow-up",
	"star",
	"list-three",
	"settings",
	"cross",
	"x",
	"alert-triangle",
	"user",
	"x-circle",
	"check-circle",
	"alert-circle",
	"help",
	"bar-chart",
	"code",
];

function TokenRow({ name, light, dark }: { name: string; light: string; dark: string }) {
	return (
		<tr className="text-sm">
			<td
				className="font-mono text-xs p-2 border"
				style={{ borderColor: "var(--border-default)" }}
			>
				--{name}
			</td>
			<td
				className="p-2 border font-mono text-xs"
				style={{ borderColor: "var(--border-default)" }}
			>
				{light}
			</td>
			<td
				className="p-2 border font-mono text-xs"
				style={{ borderColor: "var(--border-default)" }}
			>
				{dark}
			</td>
			<td className="p-2 border" style={{ borderColor: "var(--border-default)" }}>
				<div className="flex gap-1">
					<div className="w-8 h-8 rounded" style={{ background: `var(--${name})` }} />
					<div
						className="w-8 h-8 rounded dark"
						style={{ background: `var(--${name})` }}
					/>
				</div>
			</td>
		</tr>
	);
}

export default function App() {
	const [section, setSection] = useState<Section>("todas");
	const [theme, setTheme] = useState<"light" | "dark">("dark");

	function toggleTheme() {
		const next = theme === "dark" ? "light" : "dark";
		setTheme(next);
		document.documentElement.classList.toggle("dark", next === "dark");
	}

	const nav: { id: Section; label: string }[] = [
		{ id: "todas", label: "Todas" },
		{ id: "tokens", label: "Tokens" },
		{ id: "button", label: "Button" },
		{ id: "badge", label: "Badge" },
		{ id: "card", label: "Card" },
		{ id: "icon", label: "Icon" },
		{ id: "form", label: "Form" },
		{ id: "feedback", label: "Feedback" },
		{ id: "layout", label: "Layout" },
	];

	const show = (s: Section) => section === "todas" || section === s;

	return (
		<div className="max-w-5xl mx-auto">
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold">Design Toolkit</h1>
					<p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
						Catálogo visual de componentes — Letra Design System
					</p>
				</div>
				<Button variant="secondary" size="sm" onClick={toggleTheme}>
					<Icon name={theme === "dark" ? "sun" : "moon"} size={14} className="mr-1" />
					{theme === "dark" ? "Light" : "Dark"}
				</Button>
			</div>

			{/* Nav */}
			<div className="flex gap-1 mb-8 flex-wrap">
				{nav.map((n) => (
					<button
						key={n.id}
						onClick={() => setSection(n.id)}
						className="text-sm px-3 py-1.5 rounded-[var(--radius-sm)] transition-all duration-150"
						style={{
							background: section === n.id ? "var(--primary)" : "var(--surface-2)",
							color:
								section === n.id
									? "var(--primary-foreground)"
									: "var(--text-primary)",
						}}
					>
						{n.label}
					</button>
				))}
			</div>

			{/* ── Tokens ── */}
			{show("tokens") && (
				<section className="mb-12">
					<h2 className="text-xl font-bold mb-4">Tokens</h2>
					<div className="overflow-x-auto">
						<table
							className="w-full border-collapse"
							style={{ borderColor: "var(--border-default)" }}
						>
							<thead>
								<tr className="text-xs font-semibold text-left">
									<th
										className="p-2 border"
										style={{ borderColor: "var(--border-default)" }}
									>
										Token
									</th>
									<th
										className="p-2 border"
										style={{ borderColor: "var(--border-default)" }}
									>
										Light
									</th>
									<th
										className="p-2 border"
										style={{ borderColor: "var(--border-default)" }}
									>
										Dark
									</th>
									<th
										className="p-2 border"
										style={{ borderColor: "var(--border-default)" }}
									>
										Amostra
									</th>
								</tr>
							</thead>
							<tbody>
								<TokenRow
									name="surface-1"
									light="oklch(1 0 0)"
									dark="oklch(0.145 0 0)"
								/>
								<TokenRow
									name="surface-2"
									light="oklch(0.965 0 0)"
									dark="oklch(0.205 0 0)"
								/>
								<TokenRow
									name="surface-3"
									light="oklch(0.922 0 0)"
									dark="oklch(0.269 0 0)"
								/>
								<TokenRow
									name="surface-input"
									light="oklch(0.985 0 0)"
									dark="oklch(0.145 0 0)"
								/>
								<TokenRow
									name="text-primary"
									light="oklch(0.145 0 0)"
									dark="oklch(0.985 0 0)"
								/>
								<TokenRow
									name="text-secondary"
									light="oklch(0.556 0 0)"
									dark="oklch(0.708 0 0)"
								/>
								<TokenRow
									name="text-disabled"
									light="oklch(0.556 0 0 / 0.5)"
									dark="oklch(0.708 0 0 / 0.5)"
								/>
								<TokenRow
									name="text-link"
									light="oklch(0.546 0.245 262.881)"
									dark="oklch(0.685 0.246 262.881)"
								/>
								<TokenRow
									name="border-default"
									light="oklch(0.922 0 0)"
									dark="oklch(0.269 0 0)"
								/>
								<TokenRow
									name="border-hover"
									light="oklch(0.87 0 0)"
									dark="oklch(0.33 0 0)"
								/>
								<TokenRow
									name="border-focus"
									light="oklch(0.546 0.245 262.881)"
									dark="oklch(0.685 0.246 262.881)"
								/>
								<TokenRow
									name="border-disabled"
									light="oklch(0.922 0 0 / 0.5)"
									dark="oklch(0.269 0 0 / 0.5)"
								/>
							</tbody>
						</table>
					</div>
				</section>
			)}

			{/* ── Button ── */}
			{show("button") && (
				<section className="mb-12">
					<h2 className="text-xl font-bold mb-4">Button</h2>
					<div className="flex flex-wrap gap-3 items-center">
						<Button variant="default">Default</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="secondary">Outline</Button>
						<Button variant="ghost">Ghost</Button>
					</div>
					<div className="flex flex-wrap gap-3 items-center mt-3">
						<Button variant="default" size="sm">
							Small
						</Button>
						<Button variant="default" size="lg">
							Large
						</Button>
					</div>
					<div className="flex flex-wrap gap-3 items-center mt-3">
						<Button variant="default" disabled>
							Disabled
						</Button>
						<Button variant="secondary" disabled>
							Disabled
						</Button>
					</div>
					<div className="flex flex-wrap gap-3 items-center mt-3">
						<Button variant="default" className="flex items-center gap-1">
							<Icon name="plus" size={14} /> Com ícone
						</Button>
					</div>
				</section>
			)}

			{/* ── Badge ── */}
			{show("badge") && (
				<section className="mb-12">
					<h2 className="text-xl font-bold mb-4">Badge</h2>
					<div className="flex flex-wrap gap-2 items-center">
						<Badge variant="amber">default</Badge>
						<Badge variant="info">secondary</Badge>
						<Badge variant="info">outline</Badge>
						<Badge variant="success">success</Badge>
						<Badge variant="amber">warning</Badge>
					</div>
				</section>
			)}

			{/* ── Card ── */}
			{show("card") && (
				<section className="mb-12">
					<h2 className="text-xl font-bold mb-4">Card</h2>
					<div className="grid grid-cols-3 gap-4">
						<Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
							<CardContent className="p-4">
								<p className="font-medium">Card interativo</p>
								<p
									className="text-sm mt-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Com hover lift
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent className="p-4">
								<p className="font-medium">Card estático</p>
								<p
									className="text-sm mt-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Sem hover
								</p>
							</CardContent>
						</Card>
					</div>
				</section>
			)}

			{/* ── Icon ── */}
			{show("icon") && (
				<section className="mb-12">
					<h2 className="text-xl font-bold mb-4">Icon</h2>
					<div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3">
						{ICON_NAMES.map((name) => (
							<div
								key={name}
								className="flex flex-col items-center gap-1 p-2 rounded-[var(--radius-sm)] transition-all duration-150 hover:scale-110"
								style={{ background: "var(--surface-2)" }}
							>
								<Icon name={name} size={20} />
								<span
									className="text-[10px] font-mono truncate w-full text-center"
									style={{ color: "var(--text-secondary)" }}
								>
									{name}
								</span>
							</div>
						))}
					</div>
				</section>
			)}

			{/* ── Form ── */}
			{show("form") && (
				<section className="mb-12">
					<h2 className="text-xl font-bold mb-4">Form</h2>
					<div className="flex flex-col gap-4 max-w-sm">
						<Input placeholder="Input padrão" />
						<Input placeholder="Input desabilitado" disabled />
						<Textarea placeholder="Textarea" rows={3} />
						<Checkbox label="Checkbox marcado" checked />
						<Checkbox label="Checkbox desmarcado" />
					</div>
				</section>
			)}

			{/* ── Feedback ── */}
			{show("feedback") && (
				<section className="mb-12">
					<h2 className="text-xl font-bold mb-4">Feedback</h2>
					<div className="flex flex-col gap-3 max-w-lg">
						<Alert variant="info" title="Info">
							Informação geral
						</Alert>
						<Alert variant="success" title="Sucesso">
							Operação concluída
						</Alert>
						<Alert variant="warning" title="Atenção">
							Algo requer atenção
						</Alert>
						<Alert variant="error" title="Erro">
							Algo deu errado
						</Alert>
					</div>
					<div className="mt-6 max-w-sm">
						<Progress value={3} max={5} label="Progresso" />
					</div>
				</section>
			)}

			{/* ── Layout ── */}
			{show("layout") && (
				<section className="mb-12">
					<h2 className="text-xl font-bold mb-4">Layout</h2>
					<div className="flex flex-col gap-4 max-w-sm">
						<Tabs
							tabs={[
								{ id: "aba1", label: "Aba 1" },
								{ id: "aba2", label: "Aba 2" },
							]}
						>
							{(id) => (
								<div
									className="p-4 text-sm"
									style={{ color: "var(--text-secondary)" }}
								>
									Conteúdo da {id}
								</div>
							)}
						</Tabs>
						<Tooltip content="Dica flutuante" position="top">
							<Button variant="secondary" size="sm">
								Hover me
							</Button>
						</Tooltip>
						<Avatar name="John Doe" size="md" />
						<EmptyState
							title="Nada aqui"
							description="Crie um item para começar"
							action={<Button size="sm">Criar</Button>}
						/>
					</div>
				</section>
			)}
		</div>
	);
}
