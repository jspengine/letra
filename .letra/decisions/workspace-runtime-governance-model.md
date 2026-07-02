# ADR: Workspace Runtime Governance Model

**Data:** 2026-06-28  
**Contexto:** Evolução estrutural do core do Letra para configuração de workspaces, composição de pastas, equipes digitais, execução supervisionada e governança com `PGlite`  
**Status:** Proposta

## Problema

Os novos requisitos pedem capacidades legítimas:

- configurar um espaço de trabalho com múltiplas pastas
- organizar entidades operacionais para execução
- cadastrar agentes e equipes
- associar agentes a fases do fluxo
- iniciar fluxos em ferramentas agênticas externas
- registrar trilha de auditoria e governança de conteúdo gerado por IA

O risco está em materializar esses requisitos com um modelo incompatível com a constitution do Letra.

Se `project` for introduzido como nova raiz do domínio, o produto volta a ter duas unidades semânticas de valor:

- `workspace`
- `project`

Isso degrada precisamente o ativo mais importante do Letra: a qualidade do contexto entregue ao harness e às LLMs.

## Decisão

Adotar um **modelo de governança runtime centrado em workspace**, com as seguintes regras:

1. `workspace` permanece como único agregado raiz
2. `project` não entra no core como raiz arquitetural; quando necessário, será tratado como alias visual ou `scope`
3. `workflow.json` permanece como fonte transacional canônica do fluxo
4. `PGlite` entra como read model embarcado, índice de busca textual e base consultável de auditoria
5. toda mutação relevante passa por um gateway explícito de escrita e gera trilha de auditoria
6. a resolução de contexto para harness, adapters e LLMs passa a ser explícita e composta por workspace, targets, scope, run, stage, decisões e evidências
7. governança de IA deixa de ser preocupação periférica e passa a ser capacidade estrutural do domínio

## Modelo conceitual adotado

### Agregado raiz

```text
Workspace
```

### Entidades subordinadas

```text
Workspace
  ├─ Targets
  ├─ Scopes
  ├─ Agents
  ├─ Teams
  ├─ Flow Definitions
  ├─ Flow Runs
  ├─ Run Items
  ├─ Run Events
  ├─ Artifacts
  ├─ Audit Logs
  └─ AI Generation Records
```

### Interpretação de “projeto”

Quando o usuário disser “projeto”, o sistema pode mapear isso para uma destas leituras:

- o próprio `workspace`, quando a intenção for a solução inteira
- um `scope`, quando a intenção for um recorte lógico dentro do workspace
- um `target`, quando a intenção for uma pasta ou repositório local específico

O termo pode existir na linguagem de UX, mas não como raiz estrutural concorrente.

## Política de fontes de verdade

### Canônico

Persistido em arquivo:

- `workspace.json`
- `workflow.json`
- arquivos do harness e contexto do workspace
- artefatos textuais versionáveis

### Derivado

Persistido em `PGlite`:

- projeções normalizadas
- índices de busca textual
- timelines e consultas de auditoria
- materializações para UI e adapters

### Regra

O banco embarcado nunca disputa autoridade com o arquivo canônico. Se houver divergência, a fonte de verdade continua sendo o arquivo canônico, e o derivado é reindexado.

## Por que esta decisão melhora a inferência de contexto

### Antes do refinamento

O requisito original sugere múltiplas camadas de contexto potencialmente concorrentes:

- workspace
- projeto
- pasta
- fluxo
- equipe

Sem uma hierarquia explícita, adapters e LLMs passam a receber contexto redundante ou ambíguo.

### Depois do refinamento

O contexto passa a ser resolvido por composição explícita:

- qual workspace está ativo
- quais targets são relevantes
- qual scope está em foco
- qual run está em andamento
- em qual stage o trabalho se encontra
- quais agentes e gates importam agora
- quais decisões e evidências são mais recentes

Isso tende a:

- aumentar precisão contextual
- reduzir custo de tokens
- evitar contexto lateral irrelevante
- melhorar auditabilidade da cadeia de decisão

## Consequências

### Positivas

- preserva coerência com a constitution
- evita reintrodução de `project` como dívida semântica
- cria base sólida para multi-folder, equipes digitais e flows supervisionados
- permite adoção de `PGlite` com baixo risco de drift
- melhora a qualidade do contexto entregue às LLMs
- fortalece governança e auditoria como ativos do produto

### Negativas

- exige disciplina maior de modelagem e escrita
- impõe separação explícita entre canônico e derivado
- torna inadequadas soluções rápidas baseadas em CRUD superficial ou estado local isolado na UI

## Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| Introduzir `project` como novo agregado raiz | Viola a constitution e aumenta ambiguidade de contexto |
| Migrar imediatamente todo o estado para banco | Alto risco de drift e reescrita prematura |
| Manter arquivos e banco como fontes equivalentes | Cria conflito de autoridade |
| Resolver contexto por heurísticas locais em cada adapter | Escala mal e degrada previsibilidade |

## Rollout recomendado

1. Aprovar spec estrutural e design inicial
2. Introduzir esquema de projeção em `PGlite`
3. Criar gateway de escrita e política formal de sincronização
4. Implementar resolução explícita de contexto ativo
5. Adicionar entidades de time, agentes, assignments e runs
6. Expandir governança de IA e auditoria detalhada

## Próximos passos

- transformar esta decisão em item de Design no workflow
- validar o modelo ER com os módulos atuais de workspace e flow
- definir schema inicial do banco embarcado e contrato de reindexação
- derivar uma fase de implementação incremental alinhada a `architecture-convergence`
