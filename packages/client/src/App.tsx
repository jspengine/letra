import { useEffect, useState, useCallback } from "react";
import type { Workflow } from "@letra/types";
import Header from "./components/Header/Header";
import Sidebar from "./components/Sidebar/Sidebar";
import type { Tab } from "./components/Sidebar/Sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import InlineSetupWizard from "./components/SetupWizard/InlineSetupWizard";
import HomeView from "./components/Home/HomeView";
import SpecsView from "./components/Specs/SpecsView";
import FlowView from "./components/Flow/FlowView";
import ContextView from "./components/Context/ContextView";
import AuditLogView from "./components/Logs/AuditLogView";
import ExecutionView from "./components/Execution/ExecutionView";
import type { ExecStage } from "./components/Execution/ExecutionView";
import AgentDetail from "./components/Execution/AgentDetail";
import WorkspacesView from "./components/Workspaces/WorkspacesView";
import type { WorkspaceData } from "./components/Workspaces/WorkspacesView";
import UndoHistory from "./components/Diagnostics/UndoHistory";
import { ValidatingBar } from "./components/ValidatingBar";
import { ToastProvider, SkeletonCard, useToast, Icon, Button } from "@letra/ui";
import { FlowDefinitionWarnings } from "./components/Flow/FlowDefinitionWarnings";
import { createEventSourceWithReconnect } from "./lib/withReconnect";
import {
  doneStageIds,
  humanGateStageIds,
  nextStageId,
  pipelineProjection,
  type ActiveFlowDefinition,
} from "./lib/active-flow";

interface Suggestion {
  id: string;
  title: string;
  description: string;
  type: string;
  detector: string;
}

function PlaceholderView({ tab }: { tab: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3"
      style={{ color: "var(--muted-foreground)" }}
    >
      <span className="text-lg font-semibold">{tab}</span>
      <span className="text-sm">Em desenvolvimento</span>
    </div>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  dashboard: "Dashboard",
  workspaces: "Meus Workspaces",
  projects: "Repositórios",
  agents: "Agentes",
  harness: "Harness",
  knowledge: "Conhecimento",
  discovery: "Discovery",
  design: "Design",
  specs: "Specifications",
  board: "Quadro",
  "pull-requests": "Pull Requests",
  monitoring: "Monitoramento",
  audit: "Auditoria",
  settings: "Configurações",
};

function AppContent() {
  const { toast } = useToast();
  const [wf, setWf] = useState<Workflow | null>(null);
  const [activeFlow, setActiveFlow] = useState<ActiveFlowDefinition | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("workspaces");
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceData | null>(
    () => {
      try {
        const stored = localStorage.getItem("letra-active-workspace");
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    },
  );
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    const stored = localStorage.getItem("letra-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [specRefreshKey, setSpecRefreshKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [validating, setValidating] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [activeDirectory, setActiveDirectory] = useState<string | null>(() => {
    try {
      return localStorage.getItem("letra-active-directory");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("letra-theme", theme);
  }, [theme]);

  function handleSelectWorkspace(ws: WorkspaceData) {
    localStorage.setItem("letra-active-workspace", JSON.stringify(ws));
    if (activeDirectory) {
      localStorage.removeItem("letra-active-directory");
      setActiveDirectory(null);
    }
    setActiveWorkspace(ws);
    setTab("dashboard");
    const request = ws.root
      ? fetch("/api/workspace/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root: ws.root }),
        })
      : Promise.resolve();
    request.then(() => refreshWorkflow()).catch(() => refreshWorkflow());
  }

  function handleSelectDirectory(directory: string | null) {
    if (directory) {
      localStorage.setItem("letra-active-directory", directory);
    } else {
      localStorage.removeItem("letra-active-directory");
    }
    setActiveDirectory(directory);
    fetch("/api/workspace/directory/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directory }),
    })
      .then(() => refreshWorkflow())
      .catch(() => refreshWorkflow());
  }

  function refreshWorkflow() {
    Promise.all([
      fetch("/api/workflow").then((r) => r.json()),
      fetch("/api/workflow/active-flow")
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([data, flow]) => {
      if (data && !data.error) setWf(data);
      setActiveFlow(flow);
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
    const init = activeWorkspace?.root
      ? fetch("/api/workspace/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root: activeWorkspace.root }),
        }).then(() => {})
      : Promise.resolve();

    const dirInit = activeDirectory
      ? fetch("/api/workspace/directory/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ directory: activeDirectory }),
        }).then(() => {})
      : Promise.resolve();

    Promise.all([init, dirInit])
      .then(() =>
        Promise.all([
          fetch("/api/workflow").then((r) => r.json()),
          fetch("/api/workflow/active-flow")
            .then((r) => r.json())
            .catch(() => null),
        ]),
      )
      .then(([data, flow]) => {
        if (data && !data.error) setWf(data);
        setActiveFlow(flow);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    refreshDiagnostics();

    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setWorkspaces(data);
      })
      .catch(() => {});

    const es = createEventSourceWithReconnect("/events");
    es.addEventListener("workflow-updated", () => {
      refreshWorkflow();
      setSpecRefreshKey((k) => k + 1);
      setLiveMessage("Fluxo atualizado.");
    });
    es.addEventListener("diagnostics-updated", () => {
      refreshDiagnostics();
      setSpecRefreshKey((k) => k + 1);
      setLiveMessage("Diagnosticos atualizados.");
    });
    return () => es.close();
  }, [refreshDiagnostics]);

  async function handleApplySuggestion(suggestion: Suggestion) {
    try {
      setValidating(true);
      const res = await fetch("/api/diagnostics/scan", { method: "POST" });
      const data = await res.json();
      if (data.fixes?.length > 0) {
        refreshWorkflow();
        refreshDiagnostics();
        if (suggestion.detector === "harness-stale") {
          toast("Adaptadores regenerados com L1", "success");
        } else {
          toast("Item movido automaticamente", "success");
        }
      }
    } catch {
      toast("Erro ao aplicar sugestão", "error");
    } finally {
      setValidating(false);
    }
  }

  function buildExecStages(wf: Workflow): ExecStage[] {
    const stages = pipelineProjection(wf, activeFlow);
    return stages.map((stage) => {
      return {
        id: stage.id,
        label: stage.name,
        agent: stage.presentation.actorLabel,
        agentIcon: stage.presentation.icon,
        status: stage.status,
        isHumanGate: stage.presentation.isHumanGate,
        nextStageId: nextStageId(stage.id, wf, activeFlow) ?? undefined,
        rejectStageId: stages[0]?.id,
      };
    });
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

  const isSetupMode =
    new URLSearchParams(window.location.search).get("setup") === "true";

  function renderPanel() {
    if (!wf || isSetupMode) {
      return (
        <InlineSetupWizard
          onComplete={(data) => {
            setWf(data as Workflow);
            const url = new URL(window.location.href);
            url.searchParams.delete("setup");
            window.history.replaceState({}, "", url.toString());
          }}
        />
      );
    }
    if (!activeWorkspace) {
      if (tab === "workspaces") {
        return (
          <WorkspacesView
            onSelect={handleSelectWorkspace}
            gateMode
            activeDirectory={activeDirectory}
          />
        );
      }
      return (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-4 p-6"
          style={{ color: "var(--muted-foreground)" }}
        >
          <Icon name="box" size={24} className="w-10 h-10" />
          <p className="text-lg font-medium">
            Selecione ou crie um workspace para começar
          </p>
          <Button onClick={() => setTab("workspaces")}>
            Ir para Meus Workspaces
          </Button>
        </div>
      );
    }
    switch (tab) {
      case "dashboard":
        return (
          <HomeView
            workflow={wf}
            activeFlow={activeFlow}
            onSelectItem={() => {}}
            onTabChange={(t) => setTab(t as Tab)}
          />
        );
      case "workspaces":
        return (
          <WorkspacesView
            onSelect={handleSelectWorkspace}
            activeSlug={activeWorkspace.slug}
            activeDirectory={activeDirectory}
          />
        );
      case "specs":
        return <SpecsView />;
      case "board":
        return (
          <FlowView
            workflow={wf}
            activeFlow={activeFlow}
            specRefreshKey={specRefreshKey}
            onItemMoved={refreshWorkflow}
            onTabChange={(t) => setTab(t as Tab)}
          />
        );
      case "discovery":
      case "design":
        return (
          <ExecutionView
            stages={buildExecStages(wf)}
            workflow={wf}
            flowName={activeFlow?.name ?? wf.name}
          />
        );
      case "agents":
        return <AgentDetail workflow={wf} activeFlow={activeFlow} />;
      case "knowledge":
        return <ContextView />;
      case "audit":
        return <AuditLogView />;
      default:
        return <PlaceholderView tab={TAB_LABELS[tab]} />;
    }
  }

  const gateStages = wf ? humanGateStageIds(wf, activeFlow) : new Set<string>();
  const gateCount =
    wf?.items.filter((i) => gateStages.has(i.stage)).length ?? 0;

  return (
    <>
      <ValidatingBar active={validating} />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <SidebarProvider
        className="grid min-h-svh w-full grid-cols-[auto_minmax(0,1fr)]"
        style={
          {
            "--sidebar-width": "340px",
            "--sidebar-width-icon": "3rem",
          } as React.CSSProperties
        }
      >
        <Sidebar
          activeTab={tab}
          onTabChange={setTab}
          gateCount={gateCount}
          workspaceActive={!!activeWorkspace}
          activeWorkspace={activeWorkspace}
          activeDirectory={activeDirectory}
          onDirectoryChange={handleSelectDirectory}
        />
        <SidebarInset className="min-w-0">
          <div
            className="flex flex-col h-full"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
          >
            <Header
              theme={theme}
              onThemeChange={setTheme}
              suggestions={suggestions}
              onApplySuggestion={handleApplySuggestion}
              onOpenHistory={() => setShowHistory(true)}
              gateCount={gateCount}
              activeDirectory={activeDirectory}
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onWorkspaceChange={handleSelectWorkspace}
            />
            <main className="min-h-0 flex-1 flex flex-col animate-fade-in">
              <FlowDefinitionWarnings activeFlow={activeFlow} />
              {renderPanel()}
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <UndoHistory
        visible={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
