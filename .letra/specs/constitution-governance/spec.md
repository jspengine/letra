# Constitution Governance

## Outcome

Integrate `constitution.md` as an active governance layer in the harness. Constitution is always visible to agents, resolved correctly via workspace path, versioned, and auditable. Every critical decision traces back to the constitution being consulted.

## Constraints

- Constitution is single source of truth (no parallel versions)
- MCP server must resolve workspace via `.letra-link` before reading constitution
- AgentDirectionSnapshot always includes constitution when available
- Version mismatch between harness and constitution produces warnings
- Constitution read events are logged for auditability

## Exclusions

- Governance gate that blocks operations (future avenue)
- Modifying constitution content (separate item)
- Multiple constitution versions in parallel
- Automatic constitution version migration

## Context

`constitution.md` defines non-negotiable Letra rules (human-in-the-loop, harness is authority, LLM is a tool). Five concrete problems prevent effective governance: (1) MCP server receives monorepo root instead of resolved workspace, reading from wrong path; (2) AgentDirection service uses unresulved root; (3) No constitution version linked to harness; (4) No audit log of constitution consultations; (5) Constitution not in `activity.mustRead[]` for adapters.

Fix: MCP calls `resolveWorkspaceRoot()` before creating boundary. AgentDirection receives resolved workspace. `HarnessManifest.constitutionVersion` field added. `constitution_read` action added to session-log. Constitution in `governanceReferences[]` of direction snapshot.

Key files: `packages/cli/src/mcp/server.ts` (MCP resource), `packages/cli/src/direction/service.ts` (snapshot), `packages/cli/src/session-log.ts` (audit), `packages/cli/src/harness/types.ts` (manifest type).

## Acceptance Criteria

- [ ] **AC1**: `constitution.md` (v1.2.0) exists in workspace and is git-tracked
- [ ] **AC2**: MCP `letra://constitution` returns real content when file exists, empty with warning when missing
- [ ] **AC3**: MCP server uses `resolveWorkspaceRoot()` before creating boundary — path resolves correctly
- [ ] **AC4**: `AgentDirectionSnapshot.governanceReferences[]` includes constitution with path, version, available flag
- [ ] **AC5**: `HarnessManifest.constitutionVersion` field exists as optional string
- [ ] **AC6**: Version mismatch between harness declaration and constitution file produces `CONSTITUTION_VERSION_MISMATCH` warning
- [ ] **AC7**: `constitution_read` logged to session-log when MCP resource is read, direction generated, or adapter prompt includes constitution
- [ ] **AC8**: Constitution appears in `activity.mustRead[]` for at least one stage
- [ ] **AC9**: Constitution missing produces `CONSTITUTION_MISSING` warning in direction
- [ ] **AC10**: Tests: MCP returns content when file exists, returns empty when missing, snapshot includes governanceReferences, session-log records constitution_read
