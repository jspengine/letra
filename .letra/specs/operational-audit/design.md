# Design: Auditoria Operacional

> Status: proposta para revisão humana
> Updated: 2026-07-02

## Decisão arquitetural

A solução adota três camadas explícitas:

1. **Evidência canônica**: eventos append-only gravados pelo domínio e pelo harness, preservados sem alteração.
2. **Normalização**: adaptador que converte versões legadas e atuais para um contrato operacional comum, mantendo referência ao registro original.
3. **Projeção de leitura**: busca, paginação, facetas, correlação e agrupamento visual reconstruíveis a partir da evidência.

O agrupamento de ruído ocorre somente na projeção. Nenhum evento bruto é removido, reescrito ou ocultado de forma irreversível.

## Contrato operacional

```ts
interface OperationalAuditEvent {
  id: string;
  timestamp: string;
  kind: "flow" | "execution" | "human" | "system";
  action: string;
  status:
    | "started"
    | "succeeded"
    | "failed"
    | "blocked"
    | "requested"
    | "info";
  actor: {
    type: "human" | "agent" | "system";
    id?: string;
    label: string;
  };
  source: {
    surface: "cli" | "web" | "watcher" | "harness";
    command?: string;
  };
  subject?: {
    type:
      | "workspace"
      | "item"
      | "spec"
      | "ac"
      | "gate"
      | "execution"
      | "artifact";
    id: string;
    label?: string;
  };
  summary: string;
  reason?: string;
  correlationId?: string;
  details: Record<string, unknown>;
  legacy?: Record<string, unknown>;
}
```

O contrato é uma representação de leitura. Campos desconhecidos ou legados permanecem disponíveis em `legacy` ou `details`, sem descarte.

## Escrita e retenção

- A API de escrita recebe o contexto do ator e da origem, em vez de inferir tudo como `system`.
- Eventos correlacionáveis compartilham `correlationId`, especialmente início, conclusão e falha de uma execução.
- O limite em memória controla somente o carregamento da projeção, não a retenção da evidência.
- Rotação futura pode segmentar o histórico por período ou volume, desde que os segmentos permaneçam ordenados e consultáveis.
- Uma projeção derivada pode utilizar PGlite, índices em memória ou arquivos auxiliares, mas deve ser descartável e reconstruível.

## API de consulta

`GET /api/log` aceita:

- `query`, `page`, `limit`, `from` e `to`;
- `kind`, `action`, `actor`, `source` e `status`;
- `item`, `spec`, `subject` e `correlationId`;
- `grouped`, para controlar agrupamento técnico na projeção.

Resposta proposta:

```ts
interface AuditQueryResponse {
  items: OperationalAuditEvent[];
  total: number;
  page: number;
  limit: number;
  facets: {
    kinds: Record<string, number>;
    statuses: Record<string, number>;
    sources: Record<string, number>;
    actions: Record<string, number>;
  };
}
```

Parâmetros inválidos retornam erro descritivo. A ordenação padrão é decrescente por timestamp, com desempate estável por identificador.

## Experiência do usuário

### Estrutura

- Cabeçalho em largura total com título, período ativo e atualização.
- Indicadores de eventos recentes, ações humanas, execuções, falhas e gates.
- Filtros por período, origem, ator, status, ação, item/spec e texto.
- Categorias rápidas: Todos, Flow, Execuções, Humanos e Sistema.
- Timeline principal agrupada por dia e, quando útil, por correlação.
- Painel lateral de detalhes para investigação sem perder o contexto da lista.

### Semântica de uma ocorrência

Cada ocorrência responde diretamente:

- **Quem**: humano, agente ou sistema.
- **O quê**: ação de domínio realizada.
- **Onde**: item, spec, AC, gate, execução ou workspace.
- **Resultado**: sucesso, falha, bloqueio, solicitação ou informação.
- **Por quê**: motivo explícito ou contexto derivado e identificado como tal.

### Redução de ruído

Eventos técnicos repetidos são agrupados quando possuem ação, assunto e correlação equivalentes em uma janela definida. O grupo informa quantidade, primeiro e último timestamp e permite expansão completa. A categoria Sistema não domina a visão inicial, mas permanece acessível.

### Componentes

A composição deve priorizar componentes shadcn existentes:

- `Card` e `Badge` para indicadores e estados;
- `ToggleGroup` para categorias rápidas;
- `Input`, `Select` e `Popover` para filtros;
- `ScrollArea` para a timeline;
- `Sheet` com título acessível para detalhes;
- `Skeleton`, `Alert` e `Empty` para estados da consulta;
- `Pagination` para navegação determinística.

Somente tokens semânticos devem definir cores, inclusive para estados nos temas light e dark.

## Migração

1. Introduzir o normalizador e testes de fixtures legadas.
2. Corrigir o contrato de consulta mantendo compatibilidade temporária com `entries`.
3. Preservar o histórico além do limite de projeção.
4. Consolidar as duas visões atuais sob a nova página.
5. Remover aliases e caminhos antigos somente após cobertura de regressão.

## Riscos e controles

- **Crescimento do histórico**: mitigar com paginação, segmentação e índices derivados, nunca com descarte silencioso.
- **Inferência incorreta de ator ou motivo**: marcar valores derivados e preservar a evidência original.
- **Agrupamento excessivo**: permitir desativação e expansão integral.
- **Quebra de consumidores atuais**: manter adaptador de resposta durante a transição e testar ambos os contratos.
- **Contraste insuficiente**: validar light/dark, foco visível, teclado e leitores de tela.

## Sequência sugerida

1. Contrato, normalização e fixtures.
2. Persistência append-only e estratégia de retenção.
3. Consulta, paginação, busca e facetas.
4. Classificação, correlação e agrupamento.
5. Interface, responsividade e acessibilidade.
6. Consolidação das rotas antigas e validação end-to-end.
