# Design — workspace-runtime-governance

**Spec**: `workspace-runtime-governance`  
**Date**: 2026-06-28  
**Status**: Draft

---

## Objetivo

Definir o núcleo estrutural da próxima evolução do Letra para que:

- a configuração do workspace suporte múltiplas pastas locais com significado operacional
- a composição de times de agentes e fluxos supervisionados seja representável no domínio
- a inferência de contexto para harness e LLMs melhore em precisão, relevância e auditabilidade
- a introdução de `PGlite` fortaleça busca, consulta e governança sem criar outra fonte de verdade

---

## Princípio de modelagem

O requisito original usa o termo `projeto` como entidade forte. No entanto, na arquitetura do Letra isso produziria conflito direto com a constitution.

Por isso, a modelagem recomendada é:

- `workspace` permanece como agregado raiz
- `target` representa cada pasta ou repositório local participante da solução
- `scope` representa agrupamentos lógicos opcionais de targets para recortes de execução e contexto
- `team` e `agent` representam capacidade operacional
- `flow definition` define o comportamento autorizado do fluxo
- `flow run` representa uma execução concreta supervisionada

Se a palavra `projeto` for importante para UX, ela pode existir apenas como alias visual, sem papel estrutural no core.

---

## Modelo entidade-relacionamento inicial

### 1. Workspace

Entidade raiz do contexto operacional.

Campos sugeridos:

- `id`
- `slug`
- `name`
- `description`
- `status` (`active`, `archived`)
- `root_path`
- `harness_version`
- `created_at`
- `updated_at`
- `archived_at`

### 2. WorkspaceTarget

Representa cada pasta local vinculada ao workspace.

Campos sugeridos:

- `id`
- `workspace_id`
- `path`
- `label`
- `target_type` (`git`, `plain`, `docs`, `mixed`)
- `role` (`application`, `library`, `infra`, `docs`, `research`, `other`)
- `status`
- `metadata_json`

### 3. WorkspaceScope

Agrupamento lógico opcional de targets para recortar contexto, execução e supervisão.

Campos sugeridos:

- `id`
- `workspace_id`
- `name`
- `description`
- `status`

### 4. ScopeTarget

Relação N:N entre scopes e targets.

Campos sugeridos:

- `scope_id`
- `target_id`

### 5. AgentProfile

Representa um agente configurado pelo usuário.

Campos sugeridos:

- `id`
- `workspace_id`
- `name`
- `avatar`
- `professional_profile`
- `status` (`active`, `inactive`)
- `notes`

### 6. AgentSkill

Representa habilidades declaradas e rastreáveis do agente.

Campos sugeridos:

- `id`
- `agent_id`
- `skill_key`
- `label`
- `proficiency`

### 7. Team

Representa uma equipe de trabalho digital de um workspace.

Campos sugeridos:

- `id`
- `workspace_id`
- `name`
- `description`
- `status`

### 8. TeamMember

Composição N:N entre times e agentes.

Campos sugeridos:

- `team_id`
- `agent_id`
- `role_in_team`

### 9. FlowDefinition

Representa a definição autorizada do fluxo no workspace, resolvida a partir do harness e de configurações locais.

Campos sugeridos:

- `id`
- `workspace_id`
- `name`
- `version`
- `source` (`harness`, `workspace-override`, `bootstrap`)
- `status`

### 10. FlowStage

Representa os estágios do fluxo.

Campos sugeridos:

- `id`
- `flow_definition_id`
- `stage_key`
- `label`
- `order_index`
- `kind` (`work`, `gate`, `review`, `done`)
- `metadata_json`

### 11. FlowRule

Representa regras funcionais e operacionais do fluxo.

Campos sugeridos:

- `id`
- `flow_definition_id`
- `rule_type`
- `payload_json`

### 12. StageAssignment

Associa agentes, times ou capacidades a estágios.

Campos sugeridos:

- `id`
- `flow_stage_id`
- `assignment_type` (`agent`, `team`, `capability`)
- `assignment_ref`

### 13. FlowRun

Representa a execução concreta de um fluxo.

Campos sugeridos:

- `id`
- `workspace_id`
- `flow_definition_id`
- `scope_id`
- `status` (`idle`, `active`, `paused`, `completed`, `archived`)
- `started_at`
- `ended_at`

### 14. RunItem

Representa a unidade de trabalho em execução dentro de uma run.

Campos sugeridos:

- `id`
- `flow_run_id`
- `title`
- `description`
- `current_stage_id`
- `state`
- `claimed_by`

### 15. RunEvent

Representa um evento supervisionável do sistema, humano ou agente.

Campos sugeridos:

- `id`
- `workspace_id`
- `flow_run_id`
- `run_item_id`
- `actor_type` (`human`, `agent`, `system`)
- `actor_id`
- `event_type`
- `event_payload_json`
- `occurred_at`

### 16. ArtifactRecord

Representa artefatos produzidos ou referenciados ao longo da execução.

Campos sugeridos:

- `id`
- `workspace_id`
- `run_event_id`
- `artifact_type`
- `path`
- `checksum`
- `source_ref`
- `created_at`

### 17. AuditLog

Representa a trilha de auditoria de mutações e decisões.

Campos sugeridos:

- `id`
- `workspace_id`
- `subject_type`
- `subject_id`
- `action`
- `actor_type`
- `actor_id`
- `timestamp`
- `before_json`
- `after_json`

### 18. AIGenerationRecord

Representa a governança mínima de conteúdo gerado por IA.

Campos sugeridos:

- `id`
- `workspace_id`
- `flow_run_id`
- `run_event_id`
- `provider`
- `model`
- `prompt_hash`
- `context_hash`
- `output_hash`
- `policy_result`
- `created_at`

---

## Relações essenciais

- `workspace` 1:N `workspace_target`
- `workspace` 1:N `workspace_scope`
- `workspace_scope` N:N `workspace_target`
- `workspace` 1:N `agent_profile`
- `agent_profile` 1:N `agent_skill`
- `workspace` 1:N `team`
- `team` N:N `agent_profile`
- `workspace` 1:N `flow_definition`
- `flow_definition` 1:N `flow_stage`
- `flow_definition` 1:N `flow_rule`
- `flow_stage` 1:N `stage_assignment`
- `workspace` 1:N `flow_run`
- `flow_run` 1:N `run_item`
- `flow_run` 1:N `run_event`
- `run_event` 1:N `artifact_record`
- `workspace` 1:N `audit_log`
- `workspace` 1:N `ai_generation_record`

---

## Política de escrita

### 1. Artefatos canônicos

Devem continuar em arquivo versionável, auditável e humano-legível.

Inclui:

- `workspace.json`
- `workflow.json`
- harness resolvido e arquivos de contexto do workspace
- specs, decisões e artefatos textuais controlados pelo produto

### 2. Artefatos derivados

Devem ser reconstruíveis a partir dos canônicos.

Inclui:

- projeções locais em `PGlite`
- índices textuais
- visões materializadas para UI
- caches de contexto resolvido

### 3. Evidências

Devem registrar saídas observáveis produzidas por ações do sistema, de humanos ou agentes.

Inclui:

- logs de sessão
- eventos operacionais
- snapshots
- findings
- arquivos gerados
- hashes de entrada e saída de IA

### 4. Auditoria

Deve registrar mutações significativas e seu contexto decisório.

Campos mínimos por registro:

- quem agiu
- o que mudou
- quando mudou
- sobre qual entidade
- em qual workspace
- em qual run, se aplicável
- qual evidência foi produzida

---

## Papel do PGlite

`PGlite` deve entrar como banco embarcado de projeção, não como fonte primária do domínio.

Responsabilidades recomendadas:

- servir como read model local para a Web UI
- suportar busca textual em specs, decisões, eventos, logs e artefatos
- acelerar consultas de auditoria e timelines operacionais
- sustentar filtros por workspace, scope, target, stage, agente e tipo de evento

Restrições:

- não substituir `workflow.json` como fonte transacional
- não introduzir escrita concorrente sem reconciliação
- deve ser reindexável a partir dos canônicos

---

## Resolução de contexto ativo

Para melhorar a qualidade da inferência de contexto do harness, o sistema deve resolver explicitamente um contexto ativo composto por:

- `workspace`
- `scope` ativo, quando existir
- `targets` relevantes
- `flow definition` ativa
- `flow run` ativa
- `stage` atual
- `agents` associados
- `últimas decisões`
- `eventos e evidências recentes`
- `alertas e gates pendentes`

### Contrato inicial sugerido

```ts
interface ActiveContextResolution {
  workspaceId: string;
  scopeId: string | null;
  targetIds: string[];
  flowDefinitionId: string | null;
  flowRunId: string | null;
  currentStageId: string | null;
  agentIds: string[];
  pendingGateIds: string[];
  recentDecisionIds: string[];
  recentEventIds: string[];
  evidenceRefs: string[];
  source: "workflow-json" | "workspace-config" | "derived-projection" | "mixed";
}
```

### Efeito esperado

Esse modelo reduz:

- envio de contexto irrelevante para LLMs
- ambiguidade entre múltiplas pastas
- heurísticas frágeis baseadas apenas em nomes de stage ou arquivos soltos
- custo de token com leitura excessiva de contexto lateral

---

## Estratégia incremental recomendada

### Fase 0 — decisão estrutural

- aprovar spec
- aprovar ADR
- aprovar modelo ER inicial
- aprovar política de escrita

### Fase 1 — fundamentos de persistência

- introduzir gateway explícito de escrita
- definir projeção local em `PGlite`
- indexar workspace, workflow, eventos e auditoria

### Fase 2 — contexto ativo e busca

- resolver contexto ativo por composição declarativa
- disponibilizar consultas e busca textual para UI e adapters

### Fase 3 — equipes e fluxo supervisionado

- habilitar cadastro de agentes, times, assignments e runs
- refletir na UI a atividade de agentes e gates

### Fase 4 — governança avançada de IA

- registrar hashes de prompt/contexto/output
- ligar geração de IA a policy checks e evidências

---

## Riscos

### Risco 1 — reintrodução semântica de `project`

Impacto:

- quebra da constitution
- duplicação de contexto
- piora na inferência de LLM

Mitigação:

- tratar `project` apenas como alias visual ou nome de scope

### Risco 2 — concorrência entre arquivo e banco

Impacto:

- drift entre fontes
- perda de confiabilidade do harness

Mitigação:

- manter arquivos como canônicos
- usar `PGlite` apenas como projeção reconstruível

### Risco 3 — automação invisível

Impacto:

- quebra de `No Silent Automation`
- perda de auditabilidade

Mitigação:

- todo evento automático gera `run_event` e evidência correspondente

