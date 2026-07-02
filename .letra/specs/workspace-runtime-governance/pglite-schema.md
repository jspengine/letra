# PGlite Schema Inicial — workspace-runtime-governance

**Spec**: `workspace-runtime-governance`  
**Date**: 2026-06-28  
**Status**: Draft

---

## Objetivo

Definir um schema inicial para `PGlite` que sustente:

- read model local para a Web UI e futuras superfícies
- busca textual em artefatos relevantes do workspace
- consultas de auditoria, timeline e governança
- reconstrução determinística a partir das fontes canônicas

O schema abaixo não substitui o estado canônico do produto. Ele representa a primeira projeção embarcada derivada.

---

## Princípios

1. `PGlite` é projeção derivada, não fonte primária de verdade
2. Toda tabela precisa ser reconstituível a partir de arquivos canônicos e evidências
3. O schema deve priorizar consulta, busca e rastreabilidade, não autoridade transacional
4. Toda linha projetada deve carregar vínculo com sua origem (`source_type`, `source_path`, `source_version` ou equivalente)
5. O schema inicial deve ser pequeno, estável e evolutivo

---

## Escopo do schema inicial

O schema inicial cobre cinco grupos:

1. identidade do workspace e seus recortes operacionais
2. projeção do fluxo e execução
3. eventos e auditoria
4. artefatos e governança de IA
5. busca textual e metadados de indexação

---

## Convenções

### Identificadores

- `id` em formato `text`
- FKs explícitas quando o dado tiver ownership forte
- campos de referência externa mantidos como `text`

### Timestamps

- usar `timestamp` ou `text` ISO8601, conforme limitação prática da camada de acesso
- todo registro relevante deve ter `created_at`
- eventos devem ter `occurred_at`

### JSON

- usar `jsonb` ou `text` serializado, dependendo da compatibilidade final da camada PGlite escolhida
- o documento assume `jsonb` como intenção arquitetural

### Source tracking

Campos mínimos sugeridos para projeções:

- `source_type`
- `source_path`
- `source_version`
- `projected_at`

---

## Tabelas principais

### 1. `workspace_projection`

Representa o workspace ativo e seus metadados estruturais.

Campos sugeridos:

```sql
create table workspace_projection (
  id text primary key,
  slug text not null,
  name text not null,
  description text,
  status text not null,
  root_path text not null,
  harness_version text,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null,
  updated_at text
);
```

### 2. `workspace_target_projection`

Representa cada pasta/repositório participante do workspace.

```sql
create table workspace_target_projection (
  id text primary key,
  workspace_id text not null references workspace_projection(id),
  path text not null,
  label text,
  target_type text not null,
  role text,
  status text not null,
  metadata_json jsonb,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null,
  updated_at text
);
```

### 3. `workspace_scope_projection`

Representa recortes lógicos opcionais dentro do workspace.

```sql
create table workspace_scope_projection (
  id text primary key,
  workspace_id text not null references workspace_projection(id),
  name text not null,
  description text,
  status text not null,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null,
  updated_at text
);
```

### 4. `scope_target_projection`

Relaciona scopes e targets.

```sql
create table scope_target_projection (
  scope_id text not null references workspace_scope_projection(id),
  target_id text not null references workspace_target_projection(id),
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  primary key (scope_id, target_id)
);
```

### 5. `flow_definition_projection`

Representa a definição resolvida do fluxo.

```sql
create table flow_definition_projection (
  id text primary key,
  workspace_id text not null references workspace_projection(id),
  name text not null,
  version text,
  source_origin text not null,
  status text not null,
  metadata_json jsonb,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null,
  updated_at text
);
```

### 6. `flow_stage_projection`

Representa os estágios normalizados do fluxo.

```sql
create table flow_stage_projection (
  id text primary key,
  flow_definition_id text not null references flow_definition_projection(id),
  stage_key text not null,
  label text not null,
  order_index integer not null,
  kind text not null,
  zone text,
  gate_json jsonb,
  metadata_json jsonb,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null,
  updated_at text
);
```

### 7. `flow_run_projection`

Representa a execução concreta do fluxo.

```sql
create table flow_run_projection (
  id text primary key,
  workspace_id text not null references workspace_projection(id),
  flow_definition_id text references flow_definition_projection(id),
  scope_id text references workspace_scope_projection(id),
  status text not null,
  started_at text,
  ended_at text,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null,
  updated_at text
);
```

### 8. `run_item_projection`

Representa as unidades de trabalho da run.

```sql
create table run_item_projection (
  id text primary key,
  flow_run_id text not null references flow_run_projection(id),
  title text not null,
  description text,
  current_stage_id text references flow_stage_projection(id),
  state text not null,
  claimed_by text,
  metadata_json jsonb,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null,
  updated_at text
);
```

### 9. `run_event_projection`

Representa eventos supervisionáveis de execução.

```sql
create table run_event_projection (
  id text primary key,
  workspace_id text not null references workspace_projection(id),
  flow_run_id text references flow_run_projection(id),
  run_item_id text references run_item_projection(id),
  actor_type text not null,
  actor_id text,
  event_type text not null,
  event_payload_json jsonb,
  occurred_at text not null,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null
);
```

### 10. `audit_log_projection`

Representa a trilha de auditoria de mutações relevantes.

```sql
create table audit_log_projection (
  id text primary key,
  workspace_id text not null references workspace_projection(id),
  subject_type text not null,
  subject_id text not null,
  action text not null,
  actor_type text not null,
  actor_id text,
  before_json jsonb,
  after_json jsonb,
  evidence_refs_json jsonb,
  occurred_at text not null,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null
);
```

### 11. `artifact_projection`

Representa artefatos, evidências e arquivos rastreáveis.

```sql
create table artifact_projection (
  id text primary key,
  workspace_id text not null references workspace_projection(id),
  run_event_id text references run_event_projection(id),
  artifact_type text not null,
  path text,
  checksum text,
  source_ref text,
  metadata_json jsonb,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null
);
```

### 12. `ai_generation_projection`

Representa governança mínima de conteúdo gerado por IA.

```sql
create table ai_generation_projection (
  id text primary key,
  workspace_id text not null references workspace_projection(id),
  flow_run_id text references flow_run_projection(id),
  run_event_id text references run_event_projection(id),
  provider text not null,
  model text not null,
  prompt_hash text not null,
  context_hash text not null,
  output_hash text not null,
  policy_result text,
  metadata_json jsonb,
  source_type text not null,
  source_path text not null,
  source_version text not null,
  projected_at text not null,
  created_at text not null
);
```

---

## Busca textual

### 13. `search_document`

Tabela única de indexação textual para busca inicial.

```sql
create table search_document (
  id text primary key,
  workspace_id text not null references workspace_projection(id),
  doc_type text not null,
  subject_type text not null,
  subject_id text not null,
  title text,
  body text not null,
  tags_json jsonb,
  source_path text not null,
  source_version text not null,
  indexed_at text not null
);
```

### Tipos iniciais de documento

- `spec`
- `decision`
- `session-log`
- `health-record`
- `run-event`
- `artifact`
- `context`

### Estratégia inicial

- indexação full-text simples por documento consolidado
- sem ranking semântico avançado nesta fase
- suporte inicial a filtros por `workspace_id`, `doc_type`, `subject_type` e `subject_id`

---

## Tabelas de controle da projeção

### 14. `projection_checkpoint`

Controla progresso e integridade da projeção.

```sql
create table projection_checkpoint (
  projection_name text primary key,
  last_source_version text not null,
  last_projected_at text not null,
  status text not null,
  metadata_json jsonb
);
```

### 15. `projection_error`

Registra falhas de projeção e reindexação.

```sql
create table projection_error (
  id text primary key,
  projection_name text not null,
  source_type text not null,
  source_path text not null,
  source_version text,
  error_message text not null,
  error_payload_json jsonb,
  occurred_at text not null
);
```

---

## Índices iniciais recomendados

```sql
create index idx_target_workspace on workspace_target_projection(workspace_id);
create index idx_scope_workspace on workspace_scope_projection(workspace_id);
create index idx_flow_workspace on flow_definition_projection(workspace_id);
create index idx_stage_flow on flow_stage_projection(flow_definition_id, order_index);
create index idx_run_workspace on flow_run_projection(workspace_id, status);
create index idx_item_run on run_item_projection(flow_run_id, state);
create index idx_event_workspace_time on run_event_projection(workspace_id, occurred_at);
create index idx_event_item_time on run_event_projection(run_item_id, occurred_at);
create index idx_audit_workspace_time on audit_log_projection(workspace_id, occurred_at);
create index idx_ai_workspace_time on ai_generation_projection(workspace_id, created_at);
create index idx_search_workspace_type on search_document(workspace_id, doc_type);
```

---

## Política de reconstrução

### Regra

Toda projeção deve poder ser reconstruída integralmente a partir de:

- `workspace.json`
- `workflow.json`
- harness resolvido
- `session-log.json`
- `health-record.json`
- specs e decisões
- artefatos persistidos e evidências disponíveis

### Modos de rebuild

1. **Full rebuild**
   - apaga projeções derivadas
   - reprojeta tudo a partir do canônico

2. **Incremental rebuild**
   - reprojeta apenas fontes cujo `source_version` mudou

3. **Targeted rebuild**
   - reprojeta apenas um conjunto específico, como `search_document` ou `run_event_projection`

---

## Limites deliberados do schema inicial

- não há escrita operacional primária em `PGlite`
- não há materialização de todos os detalhes do harness nesta fase
- não há schema semântico avançado para embeddings
- não há sincronização remota ou multi-dispositivo

---

## Sinais de qualidade esperados

- a UI deixa de depender de parse repetido de arquivos grandes para consultas comuns
- auditoria e timeline ficam consultáveis por filtros estáveis
- busca textual funciona sem heurísticas ad hoc por arquivo
- qualquer divergência é corrigível por rebuild, não por edição manual no banco
