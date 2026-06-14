import { useEffect, useState, useCallback } from "react";
import type { Workflow } from "@letra/types";
import Header from "./components/Header/Header";
import { NavTabs } from "./components/NavTabs/NavTabs";
import InlineSetupWizard from "./components/SetupWizard/InlineSetupWizard";
import HomeView from "./components/Home/HomeView";
import SpecsView from "./components/Specs/SpecsView";
import FlowView from "./components/Flow/FlowView";
import ContextView from "./components/Context/ContextView";
import UndoHistory from "./components/Diagnostics/UndoHistory";
import { ToastProvider, SkeletonCard, useToast } from "@letra/ui";

type Tab = "home" | "specs" | "flow" | "context";

interface Suggestion {
	id: string;
	title: string;
	description: string;
	type: string;
	detector: string;
}

function AppContent() {
	const { toast } = useToast();
	const [wf, setWf] = useState<Workflow | null>(null);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<Tab>("home");
	const [theme, setTheme] = useState<"light" | "dark">(() => {
		if (typeof window === "undefined") return "dark";
		const stored = localStorage.getItem("letra-theme");
		if (stored === "light" || stored === "dark") return stored;
		return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
	});
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [showHistory, setShowHistory] = useState(false);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		localStorage.setItem("letra-theme", theme);
	}, [theme]);

	function refreshWorkflow() {
		fetch("/api/workflow")
			.then((r) => r.json())
			.then((data) => {
				if (data && !data.error) setWf(data);
			});
	}

	const refreshDiagnostics = useCallback(() => {
		fetch("/api/diagnostics")
			.then((r) => r.json())
			.then((data) => {
				if (data?.suggestions) setSuggestions(data.suggestions);
			})
			.catch(() => {});
	}, []);

	useEffect(() => {
		fetch("/api/workflow")
			.then((r) => r.json())
			.then((data) => {
				if (data && !data.error) setWf(data);
				setLoading(false);
			})
			.catch(() => setLoading(false));

		refreshDiagnostics();

		const es = new EventSource("/events");
		es.addEventListener("workflow-updated", () => refreshWorkflow());
		es.addEventListener("diagnostics-updated", () => refreshDiagnostics());
		return () => es.close();
	}, [refreshDiagnostics]);

	async function handleApplySuggestion(suggestion: Suggestion) {
		try {
			if (suggestion.detector === "stage-drift") {
				const res = await fetch("/api/diagnostics/scan", { method: "POST" });
				const data = await res.json();
				if (data.fixes?.length > 0) {
					refreshWorkflow();
					refreshDiagnostics();
					toast("Item movido automaticamente", "success");
				}
			}
		} catch {
			toast("Erro ao aplicar sugestão", "error");
		}
	}

	if (loading) {
		return (
			<div
				className="flex flex-col h-screen p-6 gap-6"
				style={{ background: "var(--background)", color: "var(--foreground)" }}
			>
				<div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
				</div>
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
				</div>
			</div>
		);
	}

	function renderPanel() {
		if (!wf) {
			return <InlineSetupWizard onComplete={(data) => setWf(data as Workflow)} />;
		}
		switch (tab) {
			case "home":
				return <HomeView workflow={wf} onSelectItem={() => {}} onTabChange={setTab} />;
			case "specs":
				return <SpecsView />;
			case "flow":
				return (
					<FlowView workflow={wf} onItemMoved={refreshWorkflow} onTabChange={setTab} />
				);
			case "context":
				return <ContextView />;
		}
	}

	return (
		<div
			className="flex flex-col h-screen"
			style={{ background: "var(--background)", color: "var(--foreground)" }}
		>
			<Header
				name={wf?.name || "Letra"}
				theme={theme}
				onThemeChange={setTheme}
				suggestions={suggestions}
				onApplySuggestion={handleApplySuggestion}
				onOpenHistory={() => setShowHistory(true)}
			/>
			<NavTabs activeTab={tab} onTabChange={setTab} />
			<main className="flex-1 min-h-0 flex flex-col animate-fade-in">{renderPanel()}</main>
			<UndoHistory visible={showHistory} onClose={() => setShowHistory(false)} />
		</div>
	);
}

export default function App() {
	return (
		<ToastProvider>
			<AppContent />
		</ToastProvider>
	);
}
