# Agent Identity & Team Management

## Outcome

Transform the harness role system (id, label, capabilities) into a full agent identity system where each agent has a name, avatar, color, bio, detailed skills, and status. Create a team management page (CRUD) and integrate agent identity into Kanban cards, supervision inbox, and adapter skill generation.

## Constraints

- Backward compatible with harness v0.2.0 (existing roles get default identities)
- Avatar must work without image upload (fallback: emoji or initials)
- Skills must be granular enough to generate useful adapter instructions
- Persistence in JSON (no external DB)
- UI follows existing design system (shadcn, OKLCH tokens, Avatar components from @letra/ui)

## Architecture

### 1. Data Model

#### `AgentIdentity` (new type in `packages/types/src/index.ts`)

```typescript
export interface AgentIdentity {
  id: string;                    // "renato" — matches role id
  displayName: string;           // "Renato" — human-friendly name
  role: string;                  // "implementer" — backing harness role
  bio: string;                   // "Engenheiro de software focado em TypeScript..."
  avatar: AgentAvatar;
  color: string;                 // OKLCH color for visual identity
  skills: AgentSkill[];
  status: AgentStatus;
  stageBindings: string[];       // ["code"] — which stages this agent covers
  adapterHints: AdapterHints;    // hints for adapter skill generation
  createdAt: string;
  updatedAt: string;
}

export interface AgentAvatar {
  type: "emoji" | "initials" | "image";
  value: string;                 // "🤖", "RE", or "/avatars/renato.png"
}

export type AgentStatus = "online" | "busy" | "away" | "offline";

export interface AgentSkill {
  id: string;                    // "typescript"
  label: string;                 // "TypeScript"
  level: "basic" | "intermediate" | "advanced" | "expert";
  category: "language" | "framework" | "tool" | "domain";
}

export interface AdapterHints {
  preferredAdapters: string[];   // ["opencode", "cursor"]
  instructionTags: string[];     // ["strict-typescript", "tdd", "functional"]
  toolPreferences: string[];     // ["vitest", "biome", "tsc"]
}
```

#### Persistence: `agents.json`

```json
// ~/.letra/workspaces/{slug}/agents.json
{
  "version": "1.0",
  "agents": [
    {
      "id": "renato",
      "displayName": "Renato",
      "role": "implementer",
      "bio": "Engenheiro de software senior. Foco em TypeScript, testes e arquitetura limpa.",
      "avatar": { "type": "emoji", "value": "🤖" },
      "color": "oklch(0.65 0.19 264)",
      "skills": [
        { "id": "typescript", "label": "TypeScript", "level": "expert", "category": "language" },
        { "id": "react", "label": "React", "level": "advanced", "category": "framework" },
        { "id": "vitest", "label": "Vitest", "level": "advanced", "category": "tool" }
      ],
      "status": "online",
      "stageBindings": ["code"],
      "adapterHints": {
        "preferredAdapters": ["opencode"],
        "instructionTags": ["strict-typescript", "tdd"],
        "toolPreferences": ["vitest", "biome"]
      },
      "createdAt": "2026-08-24T12:00:00Z",
      "updatedAt": "2026-08-24T12:00:00Z"
    }
  ]
}
```

### 2. Harness YAML Estendido

#### Novos campos em `roles/*.yaml`

```yaml
id: implementer
label: Implementer
description: Writes code, implements ACs, runs tests.

# NOVO: identidade visual
identity:
  displayName: Renato
  avatar:
    type: emoji
    value: "🤖"
  color: "oklch(0.65 0.19 264)"
  bio: "Engenheiro de software senior focado em TypeScript e testes."

# NOVO: habilidades detalhadas
skills:
  - id: typescript
    label: TypeScript
    level: expert
    category: language
  - id: react
    label: React
    level: advanced
    category: framework
  - id: vitest
    label: Vitest
    level: advanced
    category: tool

# NOVO: dicas para adapters
adapterHints:
  preferredAdapters: [opencode]
  instructionTags: [strict-typescript, tdd]
  toolPreferences: [vitest, biome]

allowedStages:
  - code
capabilities:
  - read_code
  - write_code
  - run_tests
handoff:
  blocksHandoff: false
  allowedTargets: [reviewer, security]
  requireEvidence: true
  ttlMinutes: 30
prompt-template: roles/prompts/implementer.md
```

### 3. Tipo Estendido no Harness

```typescript
// packages/cli/src/harness/types.ts — extensão

export interface AgentIdentityYAML {
  displayName?: string;
  avatar?: { type: "emoji" | "initials" | "image"; value: string };
  color?: string;
  bio?: string;
}

export interface AgentSkillYAML {
  id: string;
  label: string;
  level: "basic" | "intermediate" | "advanced" | "expert";
  category: "language" | "framework" | "tool" | "domain";
}

export interface AdapterHintsYAML {
  preferredAdapters?: string[];
  instructionTags?: string[];
  toolPreferences?: string[];
}

// Estender AgentCapability existente
export interface AgentCapability {
  id: string;
  label: string;
  description: string;
  allowedStages: string[];
  capabilities: string[];
  handoff?: AgentHandoffConfig;
  promptTemplate?: string;
  // NOVO
  identity?: AgentIdentityYAML;
  skills?: AgentSkillYAML[];
  adapterHints?: AdapterHintsYAML;
}
```

### 4. Serviço de Agentes

#### `packages/cli/src/agents/service.ts`

```typescript
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentIdentity } from "@letra/types";
import { getLetraDir } from "../workspace/resolver.js";

interface AgentsFile {
  version: string;
  agents: AgentIdentity[];
}

export class AgentService {
  private root: string;

  constructor(root: string) {
    this.root = root;
  }

  private getAgentsPath(): string {
    return join(getLetraDir(this.root), "agents.json");
  }

  load(): AgentIdentity[] {
    const path = this.getAgentsPath();
    if (!existsSync(path)) return [];
    const data = JSON.parse(readFileSync(path, "utf-8")) as AgentsFile;
    return data.agents;
  }

  save(agents: AgentIdentity[]): void {
    const path = this.getAgentsPath();
    const data: AgentsFile = { version: "1.0", agents };
    writeFileSync(path, JSON.stringify(data, null, 2));
  }

  getById(id: string): AgentIdentity | undefined {
    return this.load().find((a) => a.id === id);
  }

  getByRole(roleId: string): AgentIdentity | undefined {
    return this.load().find((a) => a.role === roleId);
  }

  create(agent: Omit<AgentIdentity, "createdAt" | "updatedAt">): AgentIdentity {
    const agents = this.load();
    const now = new Date().toISOString();
    const newAgent: AgentIdentity = { ...agent, createdAt: now, updatedAt: now };
    agents.push(newAgent);
    this.save(agents);
    return newAgent;
  }

  update(id: string, patch: Partial<AgentIdentity>): AgentIdentity | null {
    const agents = this.load();
    const idx = agents.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    agents[idx] = { ...agents[idx], ...patch, updatedAt: new Date().toISOString() };
    this.save(agents);
    return agents[idx];
  }

  delete(id: string): boolean {
    const agents = this.load();
    const filtered = agents.filter((a) => a.id !== id);
    if (filtered.length === agents.length) return false;
    this.save(filtered);
    return true;
  }

  // Gera identidades padrão a partir dos roles do harness
  seedFromHarness(harnessRoles: Record<string, any>): AgentIdentity[] {
    const existing = this.load();
    const existingIds = new Set(existing.map((a) => a.role));

    const defaults: Record<string, { avatar: string; color: string; bio: string }> = {
      analyst: { avatar: "🔍", color: "oklch(0.65 0.19 264)", bio: "Analista de requisitos e especificações." },
      implementer: { avatar: "⚡", color: "oklch(0.65 0.15 145)", bio: "Engenheiro de software. Implementa e testa." },
      reviewer: { avatar: "🔎", color: "oklch(0.65 0.15 85)", bio: "Revisor de código. Qualidade e consistência." },
      security: { avatar: "🛡️", color: "oklch(0.65 0.19 25)", bio: "Especialista em segurança e dependências." },
    };

    for (const [roleId, role] of Object.entries(harnessRoles)) {
      if (existingIds.has(roleId)) continue;
      const d = defaults[roleId] || { avatar: "🤖", color: "oklch(0.5 0 0)", bio: role.description || "" };
      existing.push({
        id: roleId,
        displayName: role.label || roleId,
        role: roleId,
        bio: d.bio,
        avatar: { type: "emoji", value: d.avatar },
        color: d.color,
        skills: (role.capabilities || []).map((c: string) => ({
          id: c, label: c.replace(/_/g, " "), level: "intermediate" as const, category: "domain" as const,
        })),
        status: "offline",
        stageBindings: role.allowedStages || [],
        adapterHints: { preferredAdapters: [], instructionTags: [], toolPreferences: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.save(existing);
    return existing;
  }
}
```

### 5. Bridge: Skills → Adapter Instructions

#### `packages/cli/src/adapters/skill-bridge.ts`

```typescript
import type { AgentIdentity, AgentSkill } from "@letra/types";

export function agentSkillsToInstructionTags(agent: AgentIdentity): string[] {
  const tags: string[] = [];

  for (const skill of agent.skills) {
    if (skill.level === "expert" || skill.level === "advanced") {
      tags.push(`use-${skill.id}`);
    }
    if (skill.level === "basic") {
      tags.push(`minimal-${skill.id}`);
    }
  }

  tags.push(...(agent.adapterHints.instructionTags || []));

  return [...new Set(tags)];
}

export function agentSkillsToInstructions(agent: AgentIdentity): string[] {
  const instructions: string[] = [];

  instructions.push(`## Agente: ${agent.displayName}`);
  instructions.push(`Função: ${agent.bio}`);

  const expertSkills = agent.skills.filter((s) => s.level === "expert");
  if (expertSkills.length > 0) {
    instructions.push(`### Expertise`);
    instructions.push(expertSkills.map((s) => `- ${s.label}: use padrões avançados, não simplifique`).join("\n"));
  }

  const advancedSkills = agent.skills.filter((s) => s.level === "advanced");
  if (advancedSkills.length > 0) {
    instructions.push(`### Proficiência`);
    instructions.push(advancedSkills.map((s) => `- ${s.label}: use com confiança, prefira estas ferramentas`).join("\n"));
  }

  const toolSkills = agent.skills.filter((s) => s.category === "tool");
  if (toolSkills.length > 0) {
    instructions.push(`### Ferramentas Preferidas`);
    instructions.push(toolSkills.map((s) => `- ${s.label}`).join("\n"));
  }

  if (agent.adapterHints.toolPreferences.length > 0) {
    instructions.push(`### Configurações`);
    instructions.push(agent.adapterHints.toolPreferences.map((t) => `- Use ${t}`).join("\n"));
  }

  return instructions;
}

export function mergeAgentSkillsIntoInstructions(
  baseInstructions: string,
  agent: AgentIdentity,
): string {
  const agentInstructions = agentSkillsToInstructions(agent);
  return `${baseInstructions}\n\n${agentInstructions.join("\n")}`;
}
```

### 6. Componentes UI

#### `AgentAvatar` (novo componente em `packages/ui/src/`)

```tsx
// packages/ui/src/agent-avatar.tsx

import type { AgentIdentity } from "@letra/types";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { AvatarWithStatus } from "./avatar-with-status";

interface AgentAvatarProps {
  agent: Pick<AgentIdentity, "avatar" | "color" | "displayName" | "status">;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
}

export function AgentAvatar({ agent, size = "md", showStatus = false }: AgentAvatarProps) {
  const statusMap: Record<string, "online" | "busy" | "away" | "offline" | "thinking"> = {
    online: "online",
    busy: "busy",
    away: "away",
    offline: "offline",
  };

  const avatarContent = (
    <Avatar size={size}>
      {agent.avatar.type === "image" ? (
        <AvatarImage src={agent.avatar.value} alt={agent.displayName} />
      ) : (
        <AvatarFallback
          size={size}
          style={{ background: agent.color, color: "white" }}
        >
          {agent.avatar.type === "emoji" ? agent.avatar.value : agent.displayName.slice(0, 2)}
        </AvatarFallback>
      )}
    </Avatar>
  );

  if (showStatus) {
    return (
      <AvatarWithStatus size={size} status={statusMap[agent.status] || "offline"}>
        {avatarContent}
      </AvatarWithStatus>
    );
  }

  return avatarContent;
}
```

#### `AgentCard` (novo componente)

```tsx
// packages/client/src/components/Agents/AgentCard.tsx

import { AvatarWithStatus, Badge, Tag } from "@letra/ui";
import type { AgentIdentity } from "@letra/types";

interface AgentCardProps {
  agent: AgentIdentity;
  itemCount?: number;
  onEdit?: (agent: AgentIdentity) => void;
}

export function AgentCard({ agent, itemCount = 0, onEdit }: AgentCardProps) {
  return (
    <Card onClick={() => onEdit?.(agent)} className="cursor-pointer">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AgentAvatar agent={agent} size="lg" showStatus />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{agent.displayName}</h3>
            <p className="text-xs text-muted-foreground">{agent.bio}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {agent.skills.slice(0, 4).map((skill) => (
            <Badge key={skill.id} variant="info" tone="soft">
              {skill.label}
              <span className="ml-1 opacity-60">{skill.level}</span>
            </Badge>
          ))}
        </div>
        {itemCount > 0 && (
          <Tag variant="agent" className="mt-2">
            {itemCount} item{itemCount > 1 ? "s" : ""} atribuído{itemCount > 1 ? "s" : ""}
          </Tag>
        )}
      </CardContent>
    </Card>
  );
}
```

### 7. Página de Gestão da Equipe

#### Rota: `/agents`

```
┌─────────────────────────────────────────────────────────┐
│  Equipe de Agentes                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  [Novo Agente]                    Buscar...     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 🤖       │  │ ⚡       │  │ 🔎       │              │
│  │ Renato   │  | Ana      │  │ Carlos   │              │
│  │ ● Online │  │ ○ Offline│  │ ● Online │              │
│  │          │  │          │  │          │              │
│  │ [TS][Re] │  │ [Spec]   │  │ [Review] │              │
│  │ 2 items  │  │ 0 items  │  │ 1 item   │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│  ┌──────────┐                                           │
│  │ 🛡️       │                                           │
│  │ Security │                                           │
│  │ ● Online │                                           │
│  │          │                                           │
│  │ [Audit]  │                                           │
│  │ 0 items  │                                           │
│  └──────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

#### Fluxo de CRUD

1. **Novo Agente** → Modal com formulário:
   - Nome (input)
   - Função (select: analyst, implementer, reviewer, security, custom)
   - Bio (textarea)
   - Avatar (seletor: emoji picker ou upload)
   - Cor (color picker OKLCH)
   - Skills (tag input com níveis)
   - Hints para adapters (checkboxes)

2. **Editar** → Mesmo modal, preenchido

3. **Excluir** → Confirmação

4. **Drag & Drop** → Reordenar prioridade

### 8. Kanban Integration

#### Mudanças em `KanbanBoard.tsx`

```tsx
// ANTES (line 203-209):
<div className="flex min-w-0 flex-wrap items-center gap-1.5 text-caption text-[var(--color-text-secondary)]">
    <Tag variant={item.claimedBy ? "agent" : "default"}>
        <Icon name={item.claimedBy ? "bot" : "circle"} size={10} />
        {agentName}
    </Tag>
    <span className="min-w-0 flex-1 basis-32 truncate">{agentAction}</span>
</div>

// DEPOIS:
const agent = resolveAgentForItem(item, resolvedStage);

<div className="flex min-w-0 flex-wrap items-center gap-1.5 text-caption text-[var(--color-text-secondary)]">
    {agent ? (
        <Tag variant="agent" style={{ borderColor: agent.color }}>
            <AgentAvatar agent={agent} size="sm" />
            {agent.displayName}
        </Tag>
    ) : (
        <Tag variant="default">
            <Icon name="circle" size={10} />
            {agentName}
        </Tag>
    )}
    <span className="min-w-0 flex-1 basis-32 truncate">{agentAction}</span>
</div>
```

#### Função auxiliar

```typescript
// packages/client/src/lib/agent-resolver.ts

import type { AgentIdentity } from "@letra/types";

export function resolveAgentForItem(
  item: Item,
  stage: ResolvedFlowStage | undefined,
  agents: AgentIdentity[],
): AgentIdentity | null {
  if (item.claimedBy) {
    return agents.find((a) => a.id === item.claimedBy || a.role === item.claimedBy) || null;
  }
  if (stage?.roleIds[0]) {
    return agents.find((a) => a.role === stage.roleIds[0]) || null;
  }
  return null;
}
```

### 9. API Endpoints

```
GET    /api/agents              → AgentIdentity[]
GET    /api/agents/:id          → AgentIdentity
POST   /api/agents              → AgentIdentity (create)
PATCH  /api/agents/:id          → AgentIdentity (update)
DELETE /api/agents/:id          → { deleted: true }
GET    /api/agents/:id/status   → { status, itemCount, stages }
```

### 10. Migração

#### `packages/cli/src/agents/migration.ts`

```typescript
export function migrateRolesToAgents(root: string): void {
  const service = new AgentService(root);
  const existing = service.load();

  if (existing.length > 0) return; // já migrado

  const harness = loadHarness(resolveHarnessRoot(root, DEFAULT_HARNESS_VERSION));
  if (!harness?.roles) return;

  service.seedFromHarness(harness.roles);
}
```

Executado automaticamente no `letra init` e no primeiro acesso à página de agentes.

### 11. Acceptance Criteria

- [ ] **AC1**: `AgentIdentity` type definido em `@letra/types` com todos os campos
- [ ] **AC2**: `agents.json` criado em `~/.letra/workspaces/{slug}/` com estrutura versionada
- [ ] **AC3**: Roles existentes (analyst, implementer, reviewer, security) recebem identidades padrão com emoji e cor
- [ ] **AC4**: Página `/agents` lista todos os agentes com avatar, nome, bio, skills e status
- [ ] **AC5**: Modal de criação/edição permite configurar nome, avatar (emoji/initials/image), cor, bio, skills com nível
- [ ] **AC6**: Kanban cards mostram avatar do agente (não icone genérico) com cor da borda
- [ ] **AC7**: `AgentAvatar` componente reutilizável usando `Avatar`/`AvatarWithStatus` do `@letra/ui`
- [ ] **AC8**: Skills do agente geram instruções para adapters via `skill-bridge.ts`
- [ ] **AC9**: API CRUD completa: GET, POST, PATCH, DELETE para `/api/agents`
- [ ] **AC10**: Migração automática: roles sem identidade recebem defaults no init
- [ ] **AC11**: `SupervisionInbox` mostra avatar e nome do agente em vez de texto plano
- [ ] **AC12**: Status do agente (online/offline/busy) refletido no `AvatarWithStatus`
- [ ] **AC13**: Backward compat: se `agents.json` não existe, sistema usa roles do harness como fallback

### 12. Impact Map

| Camada | Arquivos Afetados | Tipo de Mudança |
|--------|-------------------|-----------------|
| **Types** | `packages/types/src/index.ts` | Adicionar `AgentIdentity`, `AgentSkill`, `AgentAvatar`, `AdapterHints` |
| **Harness** | `packages/cli/src/harness/types.ts` | Estender `AgentCapability` com `identity?`, `skills?`, `adapterHints?` |
| **Harness YAML** | `packages/cli/src/harness/default/v0.2.0/roles/*.yaml` | Adicionar campos `identity`, `skills`, `adapterHints` |
| **Agents Service** | `packages/cli/src/agents/service.ts` | **NOVO** — CRUD de agentes |
| **Agents Migration** | `packages/cli/src/agents/migration.ts` | **NOVO** — seed de roles → agents |
| **Skill Bridge** | `packages/cli/src/adapters/skill-bridge.ts` | **NOVO** — skills → instruções |
| **Adapter Generate** | `packages/cli/src/adapters/generate.ts` | Injetar skills do agente nas instruções |
| **API Routes** | `packages/cli/src/flow-serve/routes/agent-routes.ts` | **NOVO** — endpoints CRUD |
| **Flow Serve** | `packages/cli/src/flow-serve.ts` | Registrar rotas de agentes |
| **UI Avatar** | `packages/ui/src/agent-avatar.tsx` | **NOVO** — componente `AgentAvatar` |
| **UI AgentCard** | `packages/client/src/components/Agents/AgentCard.tsx` | **NOVO** — card de agente |
| **UI AgentRoster** | `packages/client/src/components/Agents/AgentRoster.tsx` | **NOVO** — página de equipe |
| **UI AgentEditor** | `packages/client/src/components/Agents/AgentEditor.tsx` | **NOVO** — modal de CRUD |
| **UI AgentAvatar** | `packages/client/src/components/Agents/AgentAvatar.tsx` | **NOVO** — wrapper client-side |
| **Kanban** | `packages/client/src/components/Flow/KanbanBoard.tsx` | Usar `AgentAvatar` em vez de Tag genérica |
| **SupervisionInbox** | `packages/client/src/components/Home/SupervisionInbox.tsx` | Mostrar avatar do agente |
| **AgentDetail** | `packages/client/src/components/Execution/AgentDetail.tsx` | Usar `AgentCard` em vez de layout hardcoded |
| **App Routes** | `packages/client/src/App.tsx` | Adicionar rota `/agents` |
| **Sidebar** | Componente de navegação | Adicionar item "Equipe" |

### 13. Sequência de Implementação

1. **Fase 1: Modelo** — Types + YAML + Migration + Service
2. **Fase 2: API** — Endpoints CRUD + Rotas
3. **Fase 3: UI Core** — AgentAvatar + AgentCard + AgentRoster + AgentEditor
4. **Fase 4: Integração** — Kanban + SupervisionInbox + AgentDetail
5. **Fase 5: Bridge** — Skill→Adapter + generate.ts
6. **Fase 6: Polish** — Testes + Migração + Edge cases
