# Product Brief: Letra

**Status**: Validated · **Date**: 2026-06-08
**Fase**: GO (produto ativo, adotado por time real)

---

## Problem

Times de tecnologia usam múltiplos harnesses de IA (Cursor, Kiro, Codex, OpenCode) — cada membro escolhe o seu. Não há processo padrão dentro do time: cada um codifica, testa e especifica do seu jeito. O resultado:

- **Retrabalho massivo** — harnesses rodam sem contexto suficiente, gerando output inútil
- **Tokens LLM desperdiçados** — estimativa: 30-50% do gasto é retrabalho por falta de contexto
- **Bagunça operacional** — ninguém sabe o estado real das atividades sem uma reunião
- **Vibe coding sem processo** — comum entre devs e **não-devs**, entregas imprevisíveis

## Validation

> **Usuário real confirmado**: Tech lead com time multi-nacional, multi-harness, adotando Letra ativamente. Perfil inclui desde devs experientes até **pessoas não-técnicas** que usam IA para tarefas do dia-a-dia sem processo definido. A dor é real. O compromisso de adoção é real.

## Persona

**Primária**: Tech Lead / Eng Manager de time 5-15 pessoas, multi-ferramenta, que precisa unificar o processo sem forçar ferramenta única.

**Secundária**: Contributor individual (dev) que quer contexto rápido sem perguntar pro time.

**Terceária (CRÍTICA)**: Não-dev que usa IA para tarefas (análise, relatórios, automação, docs) sem processo definido — e sem paciência para CLI.

**Implicação**: UX visual não é opcional — é o *único* jeito do não-dev participar do processo. A CLI sozinha não resolve.

## JTBD (Jobs To Be Done)

### Primário

> "Quando estou gerenciando um time onde cada um usa seu próprio harness de IA, eu quero uma camada única de contexto e processo que todos enxerguem, para reduzir retrabalho e saber o estado real do projeto sem depender de reunião."

### Secundário

> "Quando estou codificando com meu harness, eu quero que ele já saiba o contexto do projeto, a spec da tarefa e onde ela está no fluxo, para eu não precisar explicar tudo de novo a cada prompt."

### De não-dev (validado)

> "Quando estou usando IA para uma tarefa, eu quero um painel visual que me mostre o que já foi feito, o que está pendente e qual o próximo passo, para eu não me perder no bate-papo."

**Nota**: Este JTBD é TÃO importante quanto o primário. Não-dev é parte do time e sem ele o time não entrega coeso.

## Solution Concept

Letra resolve com **três camadas**:

1. **`.letra/` (formato)** — barramento de contexto agnóstico a harness. Specs, decisões, workflow state em markdown puro. Qualquer ferramenta lê.
2. **CLI (`letra flow`)** — automação para devs: iniciar/promover itens, registrar decisões, validar estado.
3. **Flow UI (`letra flow serve`)** — visão visual do estado do time. **Porta de entrada do não-dev.** Não é opcional — é a interface que faz o time inteiro (devs e não-devs) enxergar o mesmo estado.

**Diferencial**: harness-agnostic + persona-agnostic. Dev, não-dev, Cursor, Kiro, Codex, OpenCode — todos compartilham o mesmo `.letra/`.

## Success Metrics

- **Redução de retrabalho** — menos prompts repetidos medido por diff de output
- **Tempo para "saber o estado"** — de reunião de 30min para consulta visual de 30s
- **Adoção em time multi-harness** — 2+ harnesses diferentes no mesmo projeto usando `.letra/`
- **Não-dev usando Flow UI** — sem CLI, só navegador

## Non-goals (o que NÃO vamos construir agora)

- Flow Designer visual complexo (ITEM-13) — adiado
- Template marketplace — adiado
- Skills engine — adiado

## Go-forward priorities (v0.4.0+)

Baseado na validação e no perfil não-dev:

1. **Flow UI como cidadão de primeira classe** — evoluir flow serve de kanban para flow manager (crud de itens, tasks, mover entre stages via UI)
2. **Context injection** — o `.letra/` alimentar o harness automaticamente (diminui retrabalho)
3. **Auto-detection de ferramentas** — detectar qual harness está no projeto e gerar adapter correto (já parcialmente feito)
4. **Flow promote com validação** — travar/liberar avanço baseado em comandos configurados

## Risks

- UX visual meia-boca afasta não-devs — precisa ser **intuitiva**, não precisa ser bonita
- Devs podem rejeitar "mais um processo" — o benefício imediato (menos retrabalho) precisa ser óbvio nos primeiros 5 minutos
- Manter o foco: não adicionar feature que não ataque retrabalho ou visibilidade de estado

## Next Steps

1. [x] Validar com usuário real
2. [x] Definir JTBD
3. [x] Decidir GO
4. [ ] Priorizar e implementar Flow UI como ferramenta de gestão visual
5. [ ] Implementar context injection para harnesses
6. [ ] v0.4.0 com as prioridades acima
