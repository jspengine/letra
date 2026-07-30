# Fase 0 — Integridade e Confiança

> Updated: 2026-07-03
> Status: Implementada — aguardando revisão visual
> Item: ITEM-62

## Objetivo

Eliminar afirmações e controles que não correspondem a comportamento real antes da reorganização da navegação. Esta fase não redesenha o produto; ela restabelece a confiança necessária para que o redesenho seja legítimo.

## Diagnóstico Confirmado

| Prioridade | Falha | Evidência atual | Risco |
|---|---|---|---|
| P0 | Decisão de gate não existe como operação de domínio | Aprovar e rejeitar enviam `PATCH /api/items/:id` alterando apenas `stage` | A decisão humana não possui identidade, motivo ou evidência auditável |
| P0 | Solicitar alterações é inerte | O botão não possui `onClick` | O usuário acredita ter direcionado o trabalho, mas nada acontece |
| P0 | Motivo de rejeição é descartado | `rejectReason` não recebe entrada e não é enviado à API | Perde-se o porquê da decisão |
| P0 | Estado de execução é inferido indevidamente | `claimedBy` produz `running`, “agentes”, “LLMs” e `AgentThinking` | Responsabilidade declarada é apresentada como execução real |
| P1 | Ação de item no Dashboard é inerte | `HomeView` recebe `onSelectItem={() => {}}` | O principal ponto de supervisão não leva ao objeto que exige atenção |
| P1 | Contexto e Harness são destinos duplicados | Ambos renderizam `ContextView`; Harness já é aba interna | O menu comunica duas áreas onde existe apenas uma |
| P1 | Ação de gate é ambígua com múltiplos itens | A tela procura o primeiro item do estágio com `find()` | Uma decisão pode atingir item diferente daquele imaginado pelo usuário |
| P2 | Erros operacionais são silenciados | Requisições usam `catch(() => {})` e não verificam `response.ok` | Falha parece sucesso |
| P2 | Editor do Quadro altera definição do workflow | A UI envia `PATCH /api/workflow` com `stages` | A autoridade do harness fica ambígua |

## Decisões da Fase

### 1. Gate é decisão, não movimentação

Será criado um contrato explícito para decisão humana:

```text
POST /api/items/:id/gate-decisions
{
  decision: "approve" | "request-changes" | "reject",
  reason?: string
}
```

O servidor deverá:

- confirmar que o item está em gate humano ativo;
- resolver pelo harness os destinos permitidos para cada decisão;
- exigir motivo para `request-changes` e `reject`;
- executar a transição pelo gateway canônico de escrita;
- registrar ator, decisão, motivo, origem, estágio anterior, estágio seguinte e timestamp;
- retornar erro sem mutação quando a decisão for inválida.

A UI não calculará `nextStageId` ou `rejectStageId`.

### 2. Estado exibido seguirá fatos disponíveis

Enquanto não houver `flow run` persistido:

- `claimedBy` será apresentado como **responsável** ou **item assumido**;
- `running` derivado de `claimedBy` será apresentado como **em andamento**, não “executando”;
- contadores “Agentes”, “LLMs” e indicadores de pensamento serão removidos ou renomeados;
- `Execução` será chamada **Fluxo**;
- nenhuma animação sugerirá processamento ativo sem evento real.

### 3. Toda ação terá retorno observável

As três decisões de gate terão estado de envio, sucesso, erro e atualização do workflow. Erros HTTP serão exibidos; respostas inválidas não serão tratadas como sucesso.

### 4. Toda decisão será vinculada a um item

Controles de gate serão renderizados por item. A projeção agregada por estágio não decidirá implicitamente sobre o primeiro item encontrado.

### 5. Duplicidades serão removidas antes do novo menu

`Harness` deixará de ser destino primário independente e permanecerá acessível dentro de `Contexto` até a Fase 4, quando será incorporado a `Conhecimento e Regras`.

### 6. O Dashboard abrirá contexto real

A seleção de item no Dashboard levará o usuário ao item correspondente em `Trabalho`, preservando o identificador selecionado. Navegar apenas até o Quadro sem abrir ou destacar o item não será considerado suficiente.

## Escopo de Implementação

1. Introduzir o endpoint e o serviço de decisão de gate no servidor.
2. Persistir a evidência da decisão na trilha de atividade existente.
3. Substituir as mutações diretas da tela de Fluxo pelo contrato de decisão.
4. Adicionar captura obrigatória de motivo para alteração e rejeição.
5. Tornar a seleção do Dashboard funcional e vinculada ao item.
6. Remover o destino duplicado de Harness.
7. Corrigir a linguagem e os indicadores derivados exclusivamente de `claimedBy`.
8. Cobrir decisões válidas, inválidas e falhas HTTP com testes.

## Fora Desta Fase

- Implementar os quatro destinos definitivos da navegação.
- Consolidar Fluxo e Quadro.
- Reorganizar todos os documentos em `Conhecimento e Regras`.
- Criar `flow runs` ou runtime autônomo.
- Remover o editor de workflow; essa mutação será tratada na Fase 3, mas deverá receber aviso explícito de autoridade até lá.

## Testes de Aceitação da Fase

- Aprovar um item em gate produz uma decisão auditável e a transição definida pelo harness.
- Solicitar alterações exige motivo, registra a decisão e move para o destino definido pelo harness.
- Rejeitar exige motivo, registra a decisão e move para o destino definido pelo harness.
- Decidir sobre item fora de gate retorna erro e não altera o workflow.
- Falha de rede ou resposta HTTP inválida aparece ao usuário e não simula sucesso.
- Dois itens no mesmo gate possuem ações independentes e identificadas.
- Clicar em item ou gate no Dashboard abre o item correto.
- Não existem controles primários sem efeito.
- `claimedBy` não é apresentado como evidência de agente em execução.
- Contexto e Harness não aparecem como destinos primários duplicados.

## Gate de Design

A passagem para Code requer aprovação explícita deste desenho, principalmente do contrato de decisão de gate e da remoção temporária de Harness como destino independente.

## Evidências de Implementação

- Harness `v0.1.3` declara destinos para aprovar, solicitar alterações e rejeitar.
- O endpoint de decisão valida gate, item, motivo e destino antes da escrita.
- Decisões registram ator, motivo, origem, destino e resultado na atividade.
- Movimentação genérica não pode contornar um gate humano bloqueante.
- Dashboard abre o item correto e o detalhe oferece decisões item-específicas.
- Aprovação em massa, ações inertes e o destino primário duplicado de Harness foram removidos.
- Linguagem de execução foi substituída por fluxo, papel e responsabilidade quando não existe run real.
- Testes específicos: 34 testes de domínio/rotas e 9 testes de UI relacionados passaram.
