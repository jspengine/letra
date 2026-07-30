import {
  AppSidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@letra/ui";
import { Icon } from "@letra/ui";
import type { IconName } from "@letra/ui";
import LogoDiamond from "../Header/LogoDiamond";
import type { WorkspaceData } from "../Workspaces/WorkspacesView";

export type Tab =
  | "supervision"
  | "work"
  | "knowledge"
  | "activity";

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
  color: string;
}

const PRIMARY_DESTINATIONS: NavItem[] = [
  { id: "supervision", label: "Supervisão", icon: "shield", color: "var(--color-info)" },
  { id: "work", label: "Trabalho", icon: "grid", color: "var(--color-primary)" },
  { id: "knowledge", label: "Conhecimento e Regras", icon: "book", color: "var(--color-agent)" },
  { id: "activity", label: "Atividade", icon: "activity", color: "var(--color-success)" },
];

export default function Sidebar({
  activeTab,
  onTabChange,
  workspaceActive,
}: SidebarProps) {
  const {
    open,
    isMobile,
    setOpenMobile,
  } = useSidebar();

  return (
    <ShadcnSidebar collapsible="icon" side="left">
      <SidebarHeader
        className={open ? "flex flex-row items-center border-b px-4" : "flex flex-row items-center justify-center border-b px-0"}
        style={{ borderColor: "var(--app-sidebar-border, var(--color-border))", height: "64px" }}
      >
        <div className={open ? "flex min-w-0 items-center gap-2" : "flex min-w-0 items-center justify-center"}>
          <LogoDiamond size={28} />
          <span
            data-sidebar-label="brand"
            className={open ? "truncate text-sm font-semibold text-[var(--color-text-primary)]" : "sr-only"}
          >
            Letra
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PRIMARY_DESTINATIONS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    aria-label={item.label}
                    isActive={activeTab === item.id}
                    disabled={!workspaceActive}
                    onClick={() => {
                      onTabChange(item.id);
                      if (isMobile) setOpenMobile(false);
                    }}
                    tooltip={item.label}
                  >
                    <Icon
                      name={item.icon}
                      size={16}
                      className="transition-transform duration-[var(--motion-fast)] group-hover/sidebar-menu-button:scale-110"
                      style={{ color: item.color }}
                    />
                    <span
                      data-sidebar-label={item.id}
                      className={open ? "truncate" : "sr-only"}
                    >
                      {item.label}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </ShadcnSidebar>
  );
}
