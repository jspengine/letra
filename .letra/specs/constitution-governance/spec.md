# Especificação: Governança da Constituição no Harness

**ID:** ITEM-80
**Status:** Design (v2 — revisada com confronto código/espéc)
**Descrição:** Integrar a `constitution.md` como camada de governança ativa no harness, garantindo que ela seja vista, resolvida do caminho correto via `.letra-link`, versionada e auditável pelo LLM em cada decisão crítica.

---

## Problema

A `constitution.md` define as regras não-negociáveis do Letra (ex: "human in the loop", "harness is authority", "LLM is a tool not the owner"). Existem **5 problemas concretos** que impedem que ela funcione como governança efetiva para o LLM:

### Problema A — Constitution.md deletada do workspace

O commit `378fdd4` (externalização) **deletou** `.letra/constitution.md` do monorepo local. O arquivo **não existe** no workspace externo (`~/.letra/workspaces/letra/.letra/constitution.md`).

**Consequência:** Toda a feature falha na base — não há o que ler, versionar, ou auditar. A constituição precisa ser restaurada antes da implementação.

### Problema B — Resolução de caminho incorreta no MCP

O MCP server (`server.ts`) inicia com `root = monorepo root` (`C:\Workspace\letra`), não com o workspace resolvido via `.letra-link`.

```typescript
// server.ts:253 — BUG CONFIRMADO
const path = boundary.assertPath(join(getLetraDir(workspaceRoot), "constitution.md"));
```

`getLetraDir(root)` com `root = monorepo root` resolve para `.letra/` local (vazio/deletado), não para o target do `.letra-link` (`C:\Users\rnasc\.letra\workspaces\letra`).

**Consequência:** MCP resource `letra://constitution` retorna string vazia. O LLM recebe uma constituição fantasma.

### Problema C — AgentDirection não usa `.letra-link`

O `resolveAgentDirection(root)` e `readActiveSpec(root, specName)` usam `getLetraDir(root)` — se chamado com monorepo root, lê do caminho errado.

```typescript
// service.ts:179
const specDir = join(getLetraDir(root), "specs", specName);
```

**Consequência:** O `AgentDirectionSnapshot` pode não incluir a spec ativa nem a constituição, mesmo que existam no workspace correto.

### Problema D — Sem versão vinculada ao harness

A constituição tem versão (1.2.0 no conteúdo), mas `HarnessManifest` não tem campo `constitutionVersion`. Se a constituição for atualizada, o LLM pode continuar usando uma versão desatualizada sem saber.

### Problema E — Sem registro de consulta

O `session-log.ts` não tem a action `constitution_read` no tipo `LogAction`. Não há como auditar se o LLM realmente consultou a constituição antes de decisões críticas.

---

## Diagnóstico Arquitetural

O problema **não é só "ler do caminho errado"** — é **quem passa qual `root` para quem**:

```
MONOREPO ROOT (C:\Workspace\letra)
├── .letra-link → C:\Users\rnasc\.letra\workspaces\letra
└── packages/... (código fonte)
        │
        ▼
CLI COMMANDS (flow, pulse, push)
├── Chamam resolveWorkspaceRoot(cwd) → linked mode
├── workspaceDir = C:\Users\rnasc\.letra\workspaces\letra
└── ✅ FUNCIONA — caminho resolvido corretamente
        │
        ▼
MCP SERVER (stdio transport)
├── Recebe root = C:\Workspace\letra (monorepo root)
├── Chama getLetraDir(root) → C:\Workspace\letra\.letra/
└── ❌ CAMINHO ERRADO — arquivos deletados
        │
        ▼
AGENT DIRECTION SERVICE
├── resolveAgentDirection(root) usa getLetraDir(root)
├── Se chamado via MCP com monorepo root → ❌ ERRO
└── Se chamado via CLI com cwd correto → ✅ OK
```

**Root cause:** O MCP server é iniciado com `root = monorepo root`, mas deveria usar o **workspace resolvido** (target do `.letra-link`).

---

## Transformação desejada

### Fase 0 — Restaurar constitution.md
- [ ] Restaurar `constitution.md` (v1.2.0) no workspace externo (`~/.letra/workspaces/letra/.letra/constitution.md`)
- [ ] Garantir que o arquivo é tracked no git (não pode ser deletado novamente)

### Fase 1 — Fixar resolução de caminho (Problemas B + C)
- [ ] MCP server deve chamar `resolveWorkspaceRoot(root)` antes de criar boundary
- [ ] Usar `resolution.workspaceDir` (target do `.letra-link`) em vez de `root` direto
- [ ] AgentDirection service deve receber workspace root resolvido, não monorepo root
- [ ] `readActiveSpec()` e `readFocusFile()` devem usar o mesmo workspace resolvido
- [ ] Validar: MCP `letra://constitution` retorna conteúdo real, não vazio

### Faze 2 — Versão vinculada (Problema D)
- [ ] Adicionar `constitutionVersion?: string` ao tipo `HarnessManifest`
- [ ] Adicionar `constitutionVersion?: string` ao `AgentDirectionSnapshot`
- [ ] No `createAgentDirectionSnapshot`, ler versão da constitution.md e incluir no snapshot
- [ ] Se harness declara `constitutionVersion` e constitution tem versão diferente → warning no direction

### Fase 3 — Registro de consulta (Problema E)
- [ ] Adicionar `"constitution_read"` ao tipo `LogAction` em `session-log.ts`
- [ ] Logar `constitution_read` quando:
  - MCP resource `letra://constitution` é lido
  - `AgentDirectionSnapshot` é gerado com constitution disponível
  - Adapter prompt é gerado com constitution como mustRead
- [ ] Registrar: itemId, timestamp, source (mcp|direction|adapter), version

### Fase 4 — Constitution no Direction (Problema C)
- [ ] Adicionar `governanceReferences?: GovernanceReference[]` ao `AgentDirectionSnapshot`
- [ ] Interface `GovernanceReference`: `{ path: string; version: string; available: boolean; source: string }`
- [ ] Em `createAgentDirectionSnapshot`, incluir constitution como governance reference
- [ ] Se constitution indisponível → `available: false` + warning no direction

### Fase 5 — Constitution como mustRead nos adapters
- [ ] Garantir que `constitution.md` aparece em `activity.mustRead[]` de todos os estágios
- [ ] Activity context deve incluir constitution como referência obrigatória
- [ ] Adaptadores (Cursor, OpenCode, etc.) devem listar constitution.md como L1 file

---

## Acceptance Criteria

### AC1 — Constitution restaurada e versionada
- [ ] `constitution.md` (v1.2.0) existe em `~/.letra/workspaces/letra/.letra/constitution.md`
- [ ] Arquivo é tracked no git
- [ ] `letra validate` não reporta constituição faltante

### AC2 — MCP lê constitution do caminho correto
- [ ] `letra://constitution` retorna conteúdo real (não vazio) quando constitution existe
- [ ] `letra://constitution` retorna vazio com warning quando constitution não existe
- [ ] `auditRead("constitution")` é chamado e registrado no session-log
- [ ] MCP server usa `resolveWorkspaceRoot()` antes de criar boundary

### AC3 — Constitution no AgentDirectionSnapshot
- [ ] `governanceReferences` inclui constitution quando disponível
- [ ] `constitutionVersion` reflete versão lida do arquivo
- [ ] Se constitution indisponível → `available: false` + warning code `CONSTITUTION_MISSING`
- [ ] Snapshot revisão (`revision`) muda quando constitution é adicionada/removida

### AC4 — Constitution versionada no Harness
- [ ] `HarnessManifest.constitutionVersion` existe como campo opcional
- [ ] Se declarado, `createAgentDirectionSnapshot` valida se versão lida confere
- [ ] Se versão não confere → warning `CONSTITUTION_VERSION_MISMATCH` no direction

### AC5 — Registro de consulta
- [ ] `constitution_read` é logado no session-log quando:
  - MCP resource `letra://constitution` é lido
  - Direction é gerado com constitution disponível
  - Adapter prompt inclui constitution
- [ ] Entrada inclui: itemId, timestamp, source, version, available
- [ ] `letra log --filter constitution` mostra registros

### AC6 — Constitution como mustRead
- [ ] Constitution.md aparece em `activity.mustRead[]` de pelo menos 1 estágio
- [ ] Activity context a inclui como referência de governança
- [ ] Agent direction a lista em `governanceReferences`

### AC7 — Testes
- [ ] Teste: MCP `letra://constitution` retorna conteúdo quando arquivo existe
- [ ] Teste: MCP `letra://constitution` retorna vazio quando arquivo não existe
- [ ] Teste: AgentDirectionSnapshot inclui governanceReferences
- [ ] Teste: AgentDirectionSnapshot inclui constitutionVersion
- [ ] Teste: session-log registra constitution_read
- [ ] Teste: warning CONSTITUTION_MISSING quando arquivo ausente
- [ ] Teste: warning CONSTITUTION_VERSION_MISMATCH quando versão não confere

---

## Escopo

- Fases 0-5: restauração, fix de caminho, versão, registro, direction, adapters
- Constitution como mustRead obrigatório
- Testes para todos os ACs

## Exclusions

- Gate de governança que bloqueia operação (avenida futura, fora do escopo)
- Modificar conteúdo da constituição (item separado)
- Múltiplas versões da constituição em paralelo (single source of truth)
- Migração automática de versões da constituição

---

## Impacto no Produto

### Para o Letra
1. **Confiança operacional** — O LLM sempre recebe a constituição quando disponível
2. **Auditoria real** — É possível provar que o LLM consultou a constituição antes de decisões
3. **Prevenção de drift** — Versão vinculada evita que LLM use constituição desatualizada
4. **Transparência** — Usuário vê no direction se constituição está disponível e qual versão

### Para o Harness da LLM
1. **Contexto garantido** — LLM recebe constituição junto com tarefa (não precisa buscar)
2. **Governança visível** — `governanceReferences` mostra o que é obrigatório consultar
3. **Rastreabilidade** — Cada consulta é logada; possível medir frequência de uso
4. **Fallback explícito** — Se constituição indisponível, LLM sabe que precisa de intervenção humana

### Valor mensurável
| Métrica | Antes | Depois | Impacto |
|---------|-------|--------|---------|
| Disponibilidade da constituição no direction | ~0% | 100% | LLM sempre a vê |
| Versão conhecida pelo agente | Nunca | Sempre | Previne uso de versão antiga |
| Registros de consulta no session-log | 0 | N+ | Auditoria possível |
| Indicador de indisponibilidade | Não existe | Sempre sinaliza | LLM pode pedir ajuda |
