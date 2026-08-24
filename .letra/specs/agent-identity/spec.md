# Agent Identity & Team Management

## Outcome

Transform the harness role system (id, label, capabilities) into a full agent identity system where each agent has a name, avatar, color, bio, skills, and status. Provide a team management CRUD page and integrate identity into Kanban cards, supervision inbox, and adapter skill generation.

## Constraints

- Backward compatible with harness v0.2.0 — existing roles get default identities
- Avatar works without image upload (fallback: emoji or initials)
- Skills granular enough to generate adapter instructions
- Persistence in JSON (no external DB)
- UI follows existing design system (shadcn, OKLCH, Avatar from @letra/ui)

## Exclusions

- No real-time multiplayer or presence sync
- No AI-generated avatars
- No role-based access control (all agents are equal)
- No agent-to-agent messaging (use handoff protocol)

## Context

Agent orchestration (ITEM-81) uses harness roles (analyst, implementer, reviewer, security). These roles currently have only id/label/capabilities. The supervision inbox and Kanban show generic text labels. Teams need richer identity to feel like a team and to generate better adapter instructions.

Data model: `AgentIdentity` type with id, displayName, role, bio, avatar (emoji/initials/image), color (OKLCH), skills (id/label/level/category), status, stageBindings, adapterHints. Stored in `agents.json` at `~/.letra/workspaces/{slug}/`. Harness YAML roles gain `identity`, `skills`, `adapterHints` fields.

Key files: `packages/types/src/index.ts` (types), `packages/cli/src/agents/service.ts` (CRUD), `packages/cli/src/adapters/skill-bridge.ts` (skills→instructions), `packages/ui/src/agent-avatar.tsx` (component), `packages/client/src/components/Agents/` (UI pages), API routes at `/api/agents`.

## Acceptance Criteria

- [ ] **AC1**: `AgentIdentity` type defined in `@letra/types` with all fields (avatar, skills, status, adapterHints)
- [ ] **AC2**: `agents.json` created in `~/.letra/workspaces/{slug}/` with versioned structure
- [ ] **AC3**: Existing roles (analyst, implementer, reviewer, security) receive default identities with emoji and color
- [ ] **AC4**: `/agents` page lists all agents with avatar, name, bio, skills, and status
- [ ] **AC5**: Create/edit modal configures name, avatar type+value, color, bio, skills with level
- [ ] **AC6**: Kanban cards show agent avatar (not generic icon) with colored border
- [ ] **AC7**: `AgentAvatar` reusable component using `Avatar`/`AvatarWithStatus` from `@letra/ui`
- [ ] **AC8**: Agent skills generate adapter instructions via `skill-bridge.ts`
- [ ] **AC9**: CRUD API: GET, POST, PATCH, DELETE for `/api/agents`
- [ ] **AC10**: Auto-migration: roles without identity get defaults on init
- [ ] **AC11**: SupervisionInbox shows agent avatar and name instead of plain text
- [ ] **AC12**: Agent status (online/offline/busy) reflected in `AvatarWithStatus`
- [ ] **AC13**: Backward compat: if `agents.json` missing, system falls back to harness roles
