# Acceptance Criteria — Constitution Governance (ITEM-80)

## AC1 — Constitution restaurada e versionada
- [ ] `constitution.md` (v1.2.0) existe em `~/.letra/workspaces/letra/.letra/constitution.md`
- [ ] Arquivo é tracked no git
- [ ] `letra validate` não reporta constituição faltante

## AC2 — MCP lê constitution do caminho correto
- [ ] `letra://constitution` retorna conteúdo real (não vazio) quando constitution existe
- [ ] `letra://constitution` retorna vazio com warning quando constitution não existe
- [ ] `auditRead("constitution")` é chamado e registrado no session-log
- [ ] MCP server usa `resolveWorkspaceRoot()` antes de criar boundary

## AC3 — Constitution no AgentDirectionSnapshot
- [ ] `governanceReferences` inclui constitution quando disponível
- [ ] `constitutionVersion` reflete versão lida do arquivo
- [ ] Se constitution indisponível → `available: false` + warning code `CONSTITUTION_MISSING`
- [ ] Snapshot revisão (`revision`) muda quando constitution é adicionada/removida

## AC4 — Constitution versionada no Harness
- [ ] `HarnessManifest.constitutionVersion` existe como campo opcional
- [ ] Se declarado, `createAgentDirectionSnapshot` valida se versão lida confere
- [ ] Se versão não confere → warning `CONSTITUTION_VERSION_MISMATCH` no direction

## AC5 — Registro de consulta
- [ ] `constitution_read` é logado no session-log quando:
  - MCP resource `letra://constitution` é lido
  - Direction é gerado com constitution disponível
  - Adapter prompt inclui constitution
- [ ] Entrada inclui: itemId, timestamp, source, version, available
- [ ] `letra log --filter constitution` mostra registros

## AC6 — Constitution como mustRead
- [ ] Constitution.md aparece em `activity.mustRead[]` de pelo menos 1 estágio
- [ ] Activity context a inclui como referência de governança
- [ ] Agent direction a lista em `governanceReferences`

## AC7 — Testes
- [ ] Teste: MCP `letra://constitution` retorna conteúdo quando arquivo existe
- [ ] Teste: MCP `letra://constitution` retorna vazio quando arquivo não existe
- [ ] Teste: AgentDirectionSnapshot inclui governanceReferences
- [ ] Teste: AgentDirectionSnapshot inclui constitutionVersion
- [ ] Teste: session-log registra constitution_read
- [ ] Teste: warning CONSTITUTION_MISSING quando arquivo ausente
- [ ] Teste: warning CONSTITUTION_VERSION_MISMATCH quando versão não confere

## Progresso
- [ ] AC1: 0/3
- [ ] AC2: 0/4
- [ ] AC3: 0/4
- [ ] AC4: 0/3
- [ ] AC5: 0/3
- [ ] AC6: 0/3
- [ ] AC7: 0/7
- [ ] **Total: 0/27**
