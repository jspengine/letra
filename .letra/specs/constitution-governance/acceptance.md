# Acceptance Criteria — Governança da Constituição no Harness

**Item:** ITEM-80  
**Spec:** constitution-governance  
**Status:** Draft

---

## AC1 — Resolução correta da constituição via .letra-link

**Contexto:** O MCP server (`server.ts`) e qualquer outra camada que leia `constitution.md` deve usar a lógica de resolução do `.letra-link` para encontrar o arquivo, não apenas `getLetraDir(workspaceRoot)` a partir do diretório local errado.

**Critério de aceite binário:**

- [ ] **AC1.1:** Quando o comando/cli/runner é iniciado de dentro do monorepo (`C:\Workspace\letra`) e o `.letra-link` aponta para `C:\Users\rnasc\.letra\workspaces\letra`, o MCP server lê `constitution.md` do target do link e não do `.letra/` local (que está deletado).
- [ ] **AC1.2:** `letra health --json` ou `letra direction --json` não reporta "constituição ausente" quando ela existe no target do `.letra-link`, mesmo sendo executado a partir do monorepo.
- [ ] **AC1.3:** Se o `.letra-link` não existir e o `.letra/` local existir com `constitution.md`, a leitura ainda funciona (fallback local).
- [ ] **AC1.4:** Se não houver nem `.letra-link` nem `.letra/constitution.md`, o sistema reporta explicitamente "constituição indisponível" em vez de retornar string vazia silenciosamente.

---

## AC2 — Constituição no `AgentDirectionSnapshot`

**Contexto:** O direction snapshot (retornado por `resolveAgentDirection` e exposto via `get_direction`) deve incluir a constituição como evidência de governança que o LLM pode consumir.

**Critério de aceite binário:**

- [ ] **AC2.1:** `AgentDirectionSnapshot` inclui um campo `governanceReferences: GovernanceReference[]` ou `constitution: ConstitutionReference` que lista `constitution.md` com `path`, `available`, `version`.
- [ ] **AC2.2:** Quando a constituição está disponível no workspace, o direction a inclui com `available: true` e com a versão lida do documento.
- [ ] **AC2.3:** Quando a constituição não está disponível, o direction a inclui com `available: false` e `reason` (ex: "arquivo não encontrado no workspace").
- [ ] **AC2.4:** O `get_direction` MCP tool retorna o campo de governança no JSON, de forma que o LLM que só consulta `get_direction` recebe a constituição disponível.
- [ ] **AC2.5:** A versão da constituição é extraída do cabeçalho do arquivo (ex: `**Version:** 1.3.0`) e não hardcaoded.

---

## AC3 — Versão da constituição vinculada ao direction/harness

**Contexto:** É necessário saber qual versão da constituição deve ser usada com tal versão do harness, para que o LLM não use uma constituição desatualizada sem saber.

**Critério de aceite binário:**

- [ ] **AC3.1:** `AgentDirectionSnapshot` inclui `constitutionVersion: string | null` que indica a versão da constituição lida (quando disponível) ou `null` (quando indisponível).
- [ ] **AC3.2:** O MCP server ou o adapter que gera o contexto inclui a versão da constituição como dado estruturado, não apenas como texto livre.
- [ ] **AC3.3:** Se o harness tiver uma referência à versão da constituição (ex: no manifest ou nas policies), essa referência é usada para validar se a constituição lida é a esperada, e um mismatch é sinalizado no direction.

---

## AC4 — Registro de leitura da constituição no session-log

**Contexto:** Quando a constituição é lida, deve ser registrado no `session-log` para que seja possível auditar o uso.

**Critério de aceite binário:**

- [ ] **AC4.1:** `session-log.ts` inclui `LogAction` "constitution_read" na lista de actions possíveis.
- [ ] **AC4.2:** O MCP server, ao ler o resource `letra://constitution`, loga `constitution_read` com `itemId` (se houver item ativo), `acId` (se houver AC pendente), `revision` do direction, e `details.outcome: "accepted"`.
- [ ] **AC4.3:** O `buildHarnessSnapshot` (adapters) ou o `generateAdapters`, quando inclui a constituição no prompt, loga `constitution_read` (ou `adapter_context_generated` com flag de constituição).
- [ ] **AC4.4:** O `queryLog` pode filtrar por `action: "constitution_read"` e retornar as entradas com timestamp, actor, e detalhes relevantes.

---

## AC5 — Constituição como mustRead obrigatória em compatibilidade

**Contexto:** A `activity-context/compatibility.ts` já inclui `constitution.md` como referência em `compatibilityReferences`. Isso deve permanecer e ser explicitamente documentado como obrigatório.

**Critério de aceite binário:**

- [ ] **AC5.1:** Para qualquer `ActivityKind`, a função `compatibilityReferences` inclui `constitution.md` como mustRead.
- [ ] **AC5.2:** O `buildActivityContext` (ou o `intent.ts`) não remove a constituição dos mustRead em nenhum caso.
- [ ] **AC5.3:** O direction snapshot ou o adapter prompt reflete que a constituição está entre os mustRead de compatibilidade (mesmo que indiretamente via L1 files).

---

## AC6 — Constituição como L1 file explícita em prompts de adapter

**Contexto:** `adapters/formatters.ts` já lista `constitution.md` como L1 file. Isso deve continuar e ser mantido quando novos adapters forem adicionados.

**Critério de aceite binário:**

- [ ] **AC6.1:** `L1_FILES` em `formatters.ts` inclui `.letra/constitution.md`.
- [ ] **AC6.2:** Quando novo adapter é adicionado via `instructionArtifactsForAdapters`, a constituição continua presente nos prompts gerados (não é omitida por acidente).
- [ ] **AC6.3:** Se a constituição não estiver disponível no workspace, o prompt gerado sinaliza (ex: "constituição indisponível") em vez de omitir silenciosamente.

---

## AC7 — Indicador de indisponibilidade de constituição

**Contexto:** Quando a constituição não está disponível, o sistema não deve fingir que está. Deve sinalizar explicitamente.

**Critério de aceite binário:**

- [ ] **AC7.1:** `AgentDirectionSnapshot` inclui `constitutionAvailable: boolean` (ou equivalente) e o MCP server retorna isso no JSON.
- [ ] **AC7.2:** `letra direction --json` mostra `constitutionAvailable: false` quando a constituição não está disponível.
- [ ] **AC7.3:** O MCP resource `letra://constitution` retorna um erro ou campo `available: false` quando o arquivo não existe, em vez de string vazia que o LLM pode interpretar como "não há regras".
- [ ] **AC7.4:** O LLM que recebe `constitutionAvailable: false` pode pedir para o humano resolver, em vez de alucinar regras.

---

## Critérios de aceite não cobertos por este item (avenida futura)

- [ ] Gate de governança que bloqueia operação por falta de constituição (ITEM-XX futuro).
- [ ] Modificação do conteúdo da constituição (ITEM-XX separado).
- [ ] Copiar constituição para o monorepo local (não é objetivo; usa-se o caminho correto do link).
- [ ] Múltiplas versões da constituição em paralelo (single source of truth).
