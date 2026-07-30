import { useEffect, useState, useCallback, type CSSProperties, type ReactNode } from "react";
import type { Workflow } from "@letra/types";
import Header from "./components/Header/Header";
import Sidebar from "./components/Sidebar/Sidebar";
import type { Tab } from "./components/Sidebar/Sidebar";
import InlineSetupWizard from "./components/SetupWizard/InlineSetupWizard";
import HomeView from "./components/Home/HomeView";
import FlowView from "./components/Flow/FlowView";
import ContextView from "./components/Context/ContextView";
import type { KnowledgeTab } from "./components/Context/ContextView";
import AuditLogView from "./components/Logs/AuditLogView";
import WorkspacesView from "./components/Workspaces/WorkspacesView";
import type { WorkspaceData } from "./components/Workspaces/WorkspacesView";
import { AppShell, SidebarProvider, ToastProvider, SkeletonCard, useSidebar } from "@letra/ui";
import { FlowDefinitionWarnings } from "./components/Flow/FlowDefinitionWarnings";
import { createEventSourceWithReconnect } from "./lib/withReconnect";
import {
  humanGateStageIds,
  type ActiveFlowDefinition,
} from "./lib/active-flow";

interface HealthSummary {
  activeAlerts: number;
  criticalAlerts: number;
}

function LetraAppShell({
  sidebar,
  header,
  children,
}: {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}) {
  const { open } = useSidebar();

  return (
    <AppShell
      sidebar={sidebar}
      header={header}
      sidebarCollapsed={!open}
      className="app-surface-base min-h-svh"
      style={
        {
          "--layout-sidebar-width": "var(--sidebar-width)",
          "--layout-sidebar-width-collapsed": "var(--sidebar-width-icon)",
        } as CSSProperties
      }
    >
      {children}
    </AppShell>
  );
}

function AppContent() {
  const [wf, setWf] = useState<Workflow | null>(null);
  const [activeFlow, setActiveFlow] = useState<ActiveFlowDefinition | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("supervision");
  const [knowledgeInitialTab, setKnowledgeInitialTab] =
    useState<KnowledgeTab>("context.md");
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
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [specRefreshKey, setSpecRefreshKey] = useState(0);
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
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("letra-theme", theme);
  }, [theme]);

  function handleSelectWorkspace(ws: WorkspaceData) {
    localStorage.setItem("letra-active-workspace", JSON.stringify(ws));
    if (activeDirectory) {
      localStorage.removeItem("letra-active-directory");
      setActiveDirectory(null);
    }
    setActiveWorkspace(ws);
    setTab("supervision");
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

  function handlePrimaryTabChange(nextTab: Tab) {
    if (nextTab === "knowledge") setKnowledgeInitialTab("context.md");
    setTab(nextTab);
  }

  function openKnowledge(initialTab: KnowledgeTab = "context.md") {
    setKnowledgeInitialTab(initialTab);
    setTab("knowledge");
  }

  const refreshHealth = useCallback(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        const active = Array.isArray(data?.active) ? data.active : [];
        const summary = data?.summary ?? {};
        setHealth({
          activeAlerts:
            typeof summary.activeAlerts === "number"
              ? summary.activeAlerts
              : active.length,
          criticalAlerts:
            typeof summary.criticalAlerts === "number"
              ? summary.criticalAlerts
              : active.filter((entry: { severity?: string }) =>
                  /crit|alta|high/.test(String(entry?.severity ?? "").toLowerCase()),
                ).length,
        });
      })
      .catch(() => setHealth(null));
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

    refreshHealth();

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
      refreshHealth();
      setSpecRefreshKey((k) => k + 1);
      setLiveMessage("Diagnosticos atualizados.");
    });
    return () => es.close();
  }, [refreshHealth]);

  if (loading) {
    return (
      <div className="app-surface-base flex h-screen flex-col gap-6 p-6">
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
      return (
        <WorkspacesView
          onSelect={handleSelectWorkspace}
          gateMode
          activeDirectory={activeDirectory}
        />
      );
    }
    switch (tab) {
      case "supervision":
        return (
          <HomeView
            workflow={wf}
            activeFlow={activeFlow}
            onTabChange={(t) => setTab(t as Tab)}
          />
        );
      case "work":
        return (
          <FlowView
            workflow={wf}
            activeFlow={activeFlow}
            specRefreshKey={specRefreshKey}
            onItemMoved={refreshWorkflow}
            onOpenSpec={() => openKnowledge("specs")}
          />
        );
      case "knowledge":
        return <ContextView initialTab={knowledgeInitialTab} />;
      case "activity":
        return <AuditLogView />;
      default:
        return (
          <HomeView
            workflow={wf}
            activeFlow={activeFlow}
            onTabChange={(t) => setTab(t as Tab)}
          />
        );
    }
  }

  const gateStages = wf ? humanGateStageIds(wf, activeFlow) : new Set<string>();
  const gateCount =
    wf?.items.filter((i) => gateStages.has(i.stage)).length ?? 0;

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <SidebarProvider
        className="min-h-svh w-full"
        style={
          {
            "--sidebar-width": "308px",
            "--sidebar-width-icon": "3rem",
          } as Record<string, string>
        }
      >
        <LetraAppShell
          sidebar={
            <Sidebar
              activeTab={tab}
              onTabChange={handlePrimaryTabChange}
              gateCount={gateCount}
              workspaceActive={!!activeWorkspace}
              activeWorkspace={activeWorkspace}
              activeDirectory={activeDirectory}
              onDirectoryChange={handleSelectDirectory}
            />
          }
          header={
            <Header
              theme={theme}
              onThemeChange={setTheme}
              gateCount={gateCount}
              activeDirectory={activeDirectory}
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onWorkspaceChange={handleSelectWorkspace}
              onDirectoryChange={handleSelectDirectory}
              health={health}
              onOpenHealthCenter={() => setTab("supervision")}
            />
          }
        >
          <main className="flex min-h-0 flex-1 flex-col animate-fade-in">
            <FlowDefinitionWarnings activeFlow={activeFlow} />
            {renderPanel()}
          </main>
        </LetraAppShell>
      </SidebarProvider>
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
