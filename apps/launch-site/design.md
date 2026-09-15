# Design do lançamento do Letra

## Estrutura da aplicação

Esta é uma aplicação estática independente do produto principal. Todo artefato do lançamento fica em `apps/launch-site`:

- `public/`: página e ativos publicados pelo GitHub Pages;
- `evidence/`: fontes reproduzíveis das demonstrações exibidas;
- `design.md`: narrativa, experiência e contrato de conteúdo;
- `README.md`: orientação rápida para editar, validar e publicar.

O workflow publica somente `apps/launch-site/public`, para que o artefato entregue seja explícito e independente das fontes internas.

Este documento transforma a spec `launch-site` em um plano de execução guiado pelo harness. Ele é um artefato de Design: descreve a experiência, as provas e as transições necessárias sem implementar a página.

## Promessa central

**Letra é o sistema operacional que mantém pessoas e agentes trabalhando no mesmo fluxo, sob as mesmas regras e com evidências visíveis.**

A página deve responder, nessa ordem:

1. Por que uma ideia perde qualidade quando passa por muitas ferramentas e handoffs.
2. O que muda quando contexto, regras, evidência e decisão humana passam a ser parte do fluxo.
3. Como o visitante pode experimentar isso em poucos minutos.

O primeiro bloco deve conter a frase: “Letra não é um Kanban e não executa agentes. Ele governa o contexto, o processo e os gates para que ferramentas agenticas e pessoas possam colaborar.”

## Jornada narrativa

| Momento | Pergunta do visitante | Prova que será mostrada |
| --- | --- | --- |
| Sem controle | “Por que o trabalho se perde?” | Um fluxo com contexto espalhado, handoff sem dono, drift e decisão sem registro. |
| Com Letra | “O que passa a ser controlável?” | Spec, harness, persona, claim, evidência, handoff e gate humano no mesmo percurso. |
| Autonomia com limite | “O que o agente pode fazer sozinho?” | `direction`, `claim`, `execution_event` e `request_handoff`; a transição bloqueada pelo gate humano fica evidente. |
| Primeiro uso | “Como começo?” | Comandos copiáveis: instalar, inicializar, criar spec e validar. |
| Aprofundamento | “Como adapto ao meu time?” | Links para protocolo, harness, adapters, MCP, gates e referência da CLI. |

## Visão da esteira

```text
BACKLOG                 DESIGN                 CODE                  REVIEW                 SECURITY               DONE
  ideia       ->   analyst / write_spec  ->  implementer       ->  reviewer           ->  security            -> humano aprova
                  contexto + ACs            código + testes       drift + qualidade      riscos + dependências      ou devolve
                       |                         |                    |                      |
                       +---- spec-approved -----+                    +---- code-reviewed ---+
                                                                                                    |
                                                                                         human-approved gate

Registro em cada passagem: direção (revision) -> claim -> atividade -> evidência -> handoff -> decisão.
Ferramentas possíveis: Codex, OpenCode, Cursor, Claude Code e ferramentas internas, sempre como executores sob o mesmo harness.
```

O diagrama é uma síntese visual. A página deve ligar cada etapa ao estado real retornado pelo Letra, incluindo a persona que atua, a capability usada, o próximo handoff permitido e o gate que pode bloquear a transição.

## Contrato de autonomia

O fluxo de lançamento usará a sequência operacional abaixo:

1. Consultar `direction --json` e usar a `revision` retornada como contrato de leitura.
2. Reivindicar o item com `operation claim`, informando actor, executor, capability, motivo e TTL.
3. Registrar `operation event --status started` e heartbeats durante trabalho prolongado.
4. Executar somente as ações permitidas pela persona e pela etapa atual.
5. Registrar evidências com `operation evidence` antes de solicitar handoff.
6. Solicitar `operation handoff` para o próximo papel; nunca aprovar o próprio trabalho.
7. Pedir a transição com `operation request-transition`. Se houver gate humano, o resultado esperado é `approval-required`, sem atravessar o gate.
8. Retomar após a decisão humana consultando uma nova `direction` e uma nova `revision`.

Autonomia é permitida para análise, geração de artefatos, testes, verificações e handoffs que o harness declarar. Aprovação de spec, aprovação final e qualquer ação fora das capabilities permanecem humanas.

## Provas reais para a página

As três capturas mínimas devem ser produzidas no pipeline a partir do mesmo workspace:

- **Estado:** saída de `direction --json`, com item, persona, executor, capability, objetivo e revisão.
- **Fluxo:** saída de `flow board` ou visualização do fluxo, mostrando a etapa atual e o próximo handoff.
- **Gate:** tentativa de `operation request-transition` para uma etapa bloqueada, mostrando `approval-required` e a decisão esperada.

Cada captura precisa registrar comando, versão do CLI, data, origem e texto alternativo. O pipeline deve falhar se a captura não puder ser reproduzida.

## Modelo de valor

A seção de valor não promete economia fixa. Ela permite editar as premissas e compara horas de coordenação, retrabalho e espera por decisão em três cenários:

| Porte | Premissas editáveis | Saída exibida |
| --- | --- | --- |
| Pequeno | pessoas, handoffs por item, minutos de retrabalho | horas coordenadas por ciclo |
| Médio | itens em paralelo, taxa de retrabalho, tempo de gate | horas e dias de espera evitáveis |
| Grande | times, ferramentas, handoffs cruzados, custo-hora | faixa de esforço operacional e pontos de risco |

O cálculo deve mostrar a fórmula e os valores usados. O ganho descrito é visibilidade, repetibilidade e redução de trabalho perdido; o resultado financeiro depende das premissas do visitante.

## Critério para sair de Design

O handoff para Code só deve ser solicitado quando este documento, a arquitetura de conteúdo, o plano de capturas e as premissas de valor estiverem revisados. A evidência do handoff deve apontar para este arquivo e para a spec `launch-site`. O gate `spec-approved` continua sendo a decisão humana que autoriza a implementação.
