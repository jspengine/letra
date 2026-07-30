# Roadmap: Verdade do Produto e Navegação de Supervisão

> Updated: 2026-07-03

## Princípio de Sequenciamento

Nenhuma fase amplia a promessa do produto antes de a fase anterior comprovar verdade operacional. Mudanças visuais não podem ocultar ausência de estado canônico ou ações incompletas.

## Fase 0 — Integridade e Confiança

**Objetivo:** remover discrepâncias entre o que a interface afirma e o que realmente acontece.

- Inventariar rotas duplicadas, controles inertes, decisões descartadas e estados simulados.
- Corrigir o destino duplicado de Harness e Contexto.
- Conectar as ações do item em foco no Dashboard.
- Implementar ou remover `Solicitar Alterações`.
- Persistir e auditar motivos de rejeição.
- Impedir que posição no fluxo seja apresentada como execução ativa.
- Definir testes de contrato para toda ação de gate.

**Saída:** não existem ações primárias inertes nem afirmações operacionais sem fonte rastreável.

## Fase 1 — Contexto Global e Estrutura de Navegação

**Objetivo:** separar contexto, navegação e administração.

- Levar workspace e escopo ativo para o cabeçalho.
- Tornar decisões pendentes e saúde globalmente visíveis.
- Criar os quatro destinos primários.
- Preservar temporariamente redirecionamentos das rotas anteriores.
- Mover gerenciamento de workspaces e adapters para administração secundária.

**Saída:** o menu representa perguntas do usuário, não a árvore interna do produto.

## Fase 2 — Supervisão

**Objetivo:** transformar a entrada padrão em caixa de entrada decisória.

- Priorizar decisões pendentes, bloqueios e falhas.
- Exibir atividade atual somente quando sustentada por eventos reais.
- Apresentar próxima ação segura e consequência esperada.
- Reduzir métricas sem relação direta com decisão.
- Conectar cada resumo à evidência ou artefato de origem.

**Saída:** o usuário determina em uma única tela onde sua atenção é necessária.

## Fase 3 — Trabalho

**Objetivo:** consolidar Pipeline e Quadro sem duplicar domínio.

- Criar `Trabalho` como área comum.
- Utilizar `Fluxo` como visão principal da progressão.
- Manter `Quadro` como visão alternativa dos mesmos itens.
- Remover edição direta de estágios que contorne o harness.
- Suportar múltiplos itens por estágio sem ocultação.

**Saída:** Fluxo e Quadro são projeções consistentes do mesmo estado canônico.

## Fase 4 — Conhecimento e Regras

**Objetivo:** reunir os elementos que explicam intenção, limites e decisões.

- Consolidar Especificações, Contexto, Constituição, Glossário, Decisões, Harness e Papéis.
- Aplicar a política de escrita por tipo de artefato.
- Diferenciar claramente conteúdo editável, derivado e somente leitura.
- Expor termos técnicos com explicação contextual.

**Saída:** o usuário encontra em um único lugar o que está sendo construído e as regras aplicáveis.

## Fase 5 — Atividade e Evidências

**Objetivo:** tornar a auditoria útil para supervisão cotidiana.

- Apresentar timeline orientada a acontecimentos.
- Distinguir ações humanas, agênticas e de sistema.
- Relacionar evento, motivo, regra, artefato e evidência.
- Manter filtros técnicos e exportação como aprofundamento.

**Saída:** o usuário compreende o que aconteceu sem interpretar logs brutos.

## Fase 6 — Execuções Reais

**Objetivo:** adotar linguagem e funcionalidades de execução somente após o domínio sustentá-las.

- Introduzir flow runs com identidade e ciclo de vida.
- Registrar ator, entrada, contexto, modelo, saída, duração e evidências.
- Derivar estado visual exclusivamente de eventos persistidos.
- Exibir agentes ativos, histórico e métricas somente a partir de runs reais.

**Saída:** o termo `Execuções` substitui `Fluxo` apenas quando a capacidade for verificável.

## Ordem de Entrega

| Prioridade | Fase | Dependência |
|---|---|---|
| P0 | Integridade e Confiança | Nenhuma |
| P1 | Contexto Global e Navegação | P0 |
| P1 | Supervisão | P0 e P1 |
| P2 | Trabalho | P1 |
| P2 | Conhecimento e Regras | P1 |
| P2 | Atividade e Evidências | P0 e P1 |
| P3 | Execuções Reais | Governança de runtime e eventos canônicos |
