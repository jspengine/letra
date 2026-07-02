import { useEffect, useState, useCallback } from "react";
import {
	Collapsible,
	CollapsibleTrigger,
	CollapsibleContent,
	Button,
	Icon,
} from "@letra/ui";
import { Markdown } from "../ui/markdown";

interface LayerFile {
	path: string;
	content: string;
}

interface FocusData {
	specName?: string;
	content?: string;
}

interface L2Data {
	focus: FocusData | null;
	spec: LayerFile | null;
}

interface AlertData {
	id: string;
	severity: string;
	message: string;
}

interface L3Data {
	alerts: AlertData[];
	alertCount: number;
	sessionEventCount: number;
}

interface L4Data {
	constraintsContent: string;
	glossaryContent: string;
}

interface HarnessData {
	layers: {
		l1: LayerFile[];
		l2: L2Data;
		l3: L3Data;
		l4: L4Data;
	};
}

const LAYER_INFO: Record<string, { title: string; icon: string; desc: string }> = {
	l1: { title: "Core Context", icon: "book", desc: "Arquivos fundamentais do projeto" },
	l2: { title: "Focus & Spec", icon: "target", desc: "Foco atual e especificação ativa" },
	l3: { title: "Signals & State", icon: "activity", desc: "Alertas, eventos e estado da sessão" },
	l4: { title: "Constraints & Rules", icon: "shield", desc: "Regras compiladas do sistema" },
};

function useCopyToClipboard() {
	const [copied, setCopied] = useState(false);

	const copy = useCallback(async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// fallback
		}
	}, []);

	return { copy, copied };
}

function LayerCard({
	layerKey,
	children,
	defaultOpen = false,
}: {
	layerKey: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);
	const info = LAYER_INFO[layerKey];

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger
				className="flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 hover:bg-primary/5 active:scale-[0.98]"
				style={{ color: "var(--foreground)" }}
			>
				<Icon name={info.icon as any} size={16} className="text-primary shrink-0" />
				<div className="flex-1 min-w-0">
					<div className="font-semibold text-sm">{info.title}</div>
					<div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
						{info.desc}
					</div>
				</div>
				<Icon
					name="chevron-down"
					size={16}
					style={{ color: "var(--muted-foreground)" }}
					className={open ? "rotate-180" : ""}
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="overflow-hidden transition-all duration-200">
				<div className="px-3 pb-3 pt-1">{children}</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

function L1Content({ files }: { files: LayerFile[] }) {
	return (
		<div className="space-y-3">
			{files.map((f) => (
				<div key={f.path}>
					<div className="flex items-center gap-1.5 mb-1">
						<Icon name="file-text" size={12} style={{ color: "var(--muted-foreground)" }} />
						<span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
							{f.path}
						</span>
					</div>
					{f.content ? (
						<div
							className="p-3 rounded-lg text-sm leading-relaxed"
							style={{ backgroundColor: "var(--muted)" }}
						>
							<Markdown content={f.content} />
						</div>
					) : (
						<p className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>
							(empty)
						</p>
					)}
				</div>
			))}
		</div>
	);
}

function L2Content({ l2 }: { l2: L2Data }) {
	return (
		<div className="space-y-3">
			{l2.focus && (
				<div>
					<div className="flex items-center gap-1.5 mb-1">
						<Icon name="star" size={12} style={{ color: "var(--muted-foreground)" }} />
						<span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
							.letra/focus.md
						</span>
						{l2.focus.specName && (
							<span
								className="text-xs px-1.5 py-0.5 rounded font-medium"
								style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
							>
								{l2.focus.specName}
							</span>
						)}
					</div>
					{l2.focus.content ? (
						<div
							className="p-3 rounded-lg text-sm leading-relaxed"
							style={{ backgroundColor: "var(--muted)" }}
						>
							<Markdown content={l2.focus.content} />
						</div>
					) : (
						<p className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>
							(no focus content)
						</p>
					)}
				</div>
			)}
			{l2.spec && (
				<div>
					<div className="flex items-center gap-1.5 mb-1">
						<Icon name="file-text" size={12} style={{ color: "var(--muted-foreground)" }} />
						<span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
							{l2.spec.path}
						</span>
					</div>
					<div
						className="p-3 rounded-lg text-sm leading-relaxed"
						style={{ backgroundColor: "var(--muted)" }}
					>
						<Markdown content={l2.spec.content} />
					</div>
				</div>
			)}
			{!l2.focus && !l2.spec && (
				<p className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>
					Nenhum foco ou spec ativo no momento.
				</p>
			)}
		</div>
	);
}

function L3Content({ l3 }: { l3: L3Data }) {
	return (
		<div className="space-y-3">
			<div className="flex gap-2 flex-wrap">
				<div
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
					style={{ backgroundColor: "var(--muted)" }}
				>
					<Icon name="alert-triangle" size={12} className="text-amber-500" />
					<span>{l3.alertCount} alerta(s) ativo(s)</span>
				</div>
				<div
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
					style={{ backgroundColor: "var(--muted)" }}
				>
					<Icon name="activity" size={12} style={{ color: "var(--muted-foreground)" }} />
					<span>{l3.sessionEventCount} evento(s) na sessão</span>
				</div>
			</div>

			{l3.alerts.length > 0 && (
				<div>
					<p className="text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
						Alertas recentes
					</p>
					<div className="space-y-1">
						{l3.alerts.map((a) => (
							<div
								key={a.id}
								className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs"
								style={{ backgroundColor: "var(--muted)" }}
							>
								<Icon name="alert-circle" size={12} style={{ color: a.severity === "alta" ? "var(--destructive)" : "var(--warning)" }} />
								<div className="min-w-0 flex-1">
									<div className="font-medium">{a.id}</div>
									<div style={{ color: "var(--muted-foreground)" }}>{a.message}</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function L4Content({ l4 }: { l4: L4Data }) {
	return (
		<div className="space-y-3">
			{l4.constraintsContent && (
				<div>
					<div className="flex items-center gap-1.5 mb-1">
						<Icon name="file-text" size={12} style={{ color: "var(--muted-foreground)" }} />
						<span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
							.letra/constraints.md
						</span>
					</div>
					<div
						className="p-3 rounded-lg text-sm leading-relaxed"
						style={{ backgroundColor: "var(--muted)" }}
					>
						<Markdown content={l4.constraintsContent} />
					</div>
				</div>
			)}
			{l4.glossaryContent && (
				<div>
					<div className="flex items-center gap-1.5 mb-1">
						<Icon name="file-text" size={12} style={{ color: "var(--muted-foreground)" }} />
						<span className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
							.letra/glossary.md
						</span>
					</div>
					<div
						className="p-3 rounded-lg text-sm leading-relaxed"
						style={{ backgroundColor: "var(--muted)" }}
					>
						<Markdown content={l4.glossaryContent} />
					</div>
				</div>
			)}
			{!l4.constraintsContent && !l4.glossaryContent && (
				<p className="text-xs italic" style={{ color: "var(--muted-foreground)" }}>
					Nenhuma regra ou restrição adicional.
				</p>
			)}
		</div>
	);
}

export default function HarnessViewer() {
	const [data, setData] = useState<HarnessData | null>(null);
	const [loading, setLoading] = useState(true);
	const { copy, copied } = useCopyToClipboard();

	useEffect(() => {
		fetch("/api/harness-viewer")
			.then((r) => (r.ok ? r.json() : Promise.reject()))
			.then((d: HarnessData) => {
				setData(d);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, []);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-sm animate-pulse" style={{ color: "var(--muted-foreground)" }}>
					Loading...
				</p>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
					Unable to load harness data.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-0 overflow-hidden">
			<div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
				<div>
					<h2 className="text-sm font-semibold">Harness Composition</h2>
					<p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
						Camadas do prompt compilado para o agente
					</p>
				</div>
				<Button
					type="button"
					onClick={() => {
						const text = JSON.stringify(data, null, 2);
						copy(text);
					}}
					className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 hover:bg-primary/10 active:scale-95"
					style={{ backgroundColor: "var(--muted)" }}
					aria-label="Copy harness data"
				>
					<Icon name={copied ? "check" : "copy"} size={12} />
					{copied ? "Copied!" : "Copy"}
				</Button>
			</div>

			<div className="flex-1 overflow-y-auto p-3 space-y-1">
				<LayerCard layerKey="l1" defaultOpen>
					<L1Content files={data.layers.l1} />
				</LayerCard>
				<LayerCard layerKey="l2" defaultOpen>
					<L2Content l2={data.layers.l2} />
				</LayerCard>
				<LayerCard layerKey="l3">
					<L3Content l3={data.layers.l3} />
				</LayerCard>
				<LayerCard layerKey="l4">
					<L4Content l4={data.layers.l4} />
				</LayerCard>
			</div>
		</div>
	);
}
