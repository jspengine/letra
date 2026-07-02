import { Badge, Button, Icon, Select, SelectTrigger, SelectContent, SelectItem } from "@letra/ui";
import DiagnosticsIndicator from "../Diagnostics/DiagnosticsIndicator";
import type { WorkspaceData } from "../Workspaces/WorkspacesView";

interface Suggestion {
  id: string;
  title: string;
  description: string;
  type: string;
  detector: string;
}

interface Props {
  description?: string;
  theme: "light" | "dark";
  onThemeChange: (t: "light" | "dark") => void;
  suggestions?: Suggestion[];
  onApplySuggestion?: (s: Suggestion) => void;
  onOpenHistory?: () => void;
  gateCount?: number;
  activeDirectory?: string | null;
  workspaces: WorkspaceData[];
  activeWorkspace?: WorkspaceData | null;
  onWorkspaceChange?: (ws: WorkspaceData) => void;
}

export default function Header({
  theme,
  onThemeChange,
  suggestions = [],
  onApplySuggestion,
  onOpenHistory,
  gateCount = 0,
  activeDirectory,
  workspaces,
  activeWorkspace,
  onWorkspaceChange,
}: Props) {
  return (
    <header
      className="flex items-center justify-between px-4"
      style={{
        height: "64px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
        color: "var(--foreground)",
      }}
    >
      <div className="flex items-center gap-3">
        {(activeWorkspace || activeDirectory) && (
          <span className="text-sm truncate max-w-md" style={{ color: "var(--muted-foreground)" }}>
            {activeWorkspace?.name ?? ""}
            {activeDirectory && (
              <> / <span className="font-mono">{activeDirectory.split(/[/\\]/).pop()}</span></>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={activeWorkspace?.slug ?? ""}
          onValueChange={(slug) => {
            const ws = workspaces.find((w) => w.slug === slug);
            if (ws) onWorkspaceChange?.(ws);
          }}
        >
          <SelectTrigger className="flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium min-w-[200px] max-w-[280px]">
            <Icon name="box" size={16} />
            <span className="flex-1 truncate text-left">
              {activeWorkspace ? activeWorkspace.name : "Selecionar workspace"}
            </span>
          </SelectTrigger>
          <SelectContent>
            {workspaces.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                Nenhum workspace encontrado
              </div>
            ) : (
              workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.slug}>
                  <div className="flex items-center gap-2">
                    <Icon name={activeWorkspace?.slug === ws.slug ? "check" : "box"} size={14} />
                    <span className="truncate">{ws.name}</span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {gateCount > 0 && (
          <Badge variant="warning" className="animate-pulse-gate-waiting text-xs">
            {gateCount} gate pendente
          </Badge>
        )}

        {suggestions.length > 0 && onApplySuggestion && onOpenHistory && (
          <DiagnosticsIndicator
            suggestions={suggestions}
            onApplyFix={onApplySuggestion}
            onOpenHistory={onOpenHistory}
          />
        )}

        <Button
          type="button"
          onClick={() => onOpenHistory?.()}
          className="p-1.5 rounded hover:opacity-70 transition-opacity"
          style={{ color: "var(--muted-foreground)" }}
          aria-label="Histórico de correções"
        >
          <Icon name="settings" size={16} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
        </Button>
      </div>
    </header>
  );
}
