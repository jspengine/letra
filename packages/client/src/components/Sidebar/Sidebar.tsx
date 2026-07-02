import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Icon, Button } from "@letra/ui";
import type { IconName } from "@letra/ui";
import LogoDiamond from "../Header/LogoDiamond";
import type { WorkspaceData } from "../Workspaces/WorkspacesView";

export type Tab =
  | "dashboard"
  | "workspaces"
  | "projects"
  | "agents"
  | "harness"
  | "knowledge"
  | "discovery"
  | "design"
  | "specs"
  | "board"
  | "pull-requests"
  | "monitoring"
  | "audit"
  | "settings";

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  gateCount?: number;
  workspaceActive?: boolean;
  activeWorkspace?: WorkspaceData | null;
  activeDirectory?: string | null;
  onDirectoryChange?: (dir: string | null) => void;
}

interface NavItem {
  id: Tab;
  label: string;
  icon: IconName;
  disabled?: boolean;
}

const WORKSPACE_GROUP: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "workspaces", label: "Meus Workspaces", icon: "box" },
  { id: "agents", label: "Agentes", icon: "cpu" },
  { id: "harness", label: "Harness", icon: "settings", disabled: true },
  { id: "knowledge", label: "Conhecimento", icon: "book" },
];

const EXECUTION_GROUP: NavItem[] = [
  { id: "discovery", label: "Discovery", icon: "search" },
  { id: "design", label: "Design", icon: "pen-tool" },
  { id: "specs", label: "Specifications", icon: "specs" },
  { id: "board", label: "Quadro", icon: "grid" },
  {
    id: "pull-requests",
    label: "Pull Requests",
    icon: "git-branch",
    disabled: true,
  },
  {
    id: "monitoring",
    label: "Monitoramento",
    icon: "activity",
    disabled: true,
  },
];

const GOVERNANCE_GROUP: NavItem[] = [
  { id: "audit", label: "Auditoria", icon: "shield" },
  { id: "settings", label: "Configurações", icon: "settings", disabled: true },
];

function NavMenuItems({
  items,
  activeTab,
  onTabChange,
  workspaceActive,
}: {
  items: NavItem[];
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  workspaceActive?: boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const blocked = !workspaceActive && item.id !== "workspaces";
        const disabled = item.disabled || blocked;
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              isActive={activeTab === item.id}
              disabled={disabled}
              onClick={() => onTabChange(item.id)}
              tooltip={item.label}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </>
  );
}

export default function Sidebar({
  activeTab,
  onTabChange,
  gateCount = 0,
  workspaceActive,
  activeWorkspace,
  activeDirectory,
  onDirectoryChange,
}: SidebarProps) {
  const { open: sidebarOpen, toggleSidebar } = useSidebar();

  return (
    <ShadcnSidebar collapsible="icon" side="left" style={{ zIndex: 60 }}>
      <SidebarHeader
        className="flex flex-row items-center justify-between border-b px-4"
        style={{ borderColor: "var(--border)", height: "64px" }}
      >
        <div className="flex items-center gap-2">
          <LogoDiamond size={28} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="hover:bg-sidebar-accent transition-colors shrink-0"
          aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"}
        >
          <Icon name="list-three" size={18} />
        </Button>
      </SidebarHeader>

      <SidebarContent>
        {sidebarOpen &&
          workspaceActive &&
          activeWorkspace?.directories &&
          activeWorkspace.directories.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Pastas</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {activeWorkspace.directories.map((dir) => {
                    const isActive = activeDirectory === dir;
                    const label = dir.split(/[/\\]/).pop() || dir;
                    return (
                      <SidebarMenuItem key={dir}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() =>
                            onDirectoryChange?.(isActive ? null : dir)
                          }
                          tooltip={label}
                        >
                          <Icon
                            name={isActive ? "check" : "folder"}
                            size={14}
                          />
                          <span className="truncate">{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavMenuItems
                items={WORKSPACE_GROUP}
                activeTab={activeTab}
                onTabChange={onTabChange}
                workspaceActive={workspaceActive}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Execução</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavMenuItems
                items={EXECUTION_GROUP}
                activeTab={activeTab}
                onTabChange={onTabChange}
                workspaceActive={workspaceActive}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Governança</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavMenuItems
                items={GOVERNANCE_GROUP}
                activeTab={activeTab}
                onTabChange={onTabChange}
                workspaceActive={workspaceActive}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter
        className="border-t p-3"
        style={{ borderColor: "var(--border)" }}
      >
        {gateCount > 0 && (
          <div className="flex items-center gap-2 animate-pulse-gate-urgent">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: "var(--gate-available)" }}
            />
            {sidebarOpen && (
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--gate-available)" }}
              >
                {gateCount} gate pendente{gateCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </SidebarFooter>

    </ShadcnSidebar>
  );
}
