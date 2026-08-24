# Referências de UX — Dashboards de Projeto com Agentes

**Data:** 2026-06-21  
**Imagens:** 
- `sketches/references/agentwork-projeto-astro.png`
- `sketches/references/pitagor-projeto-orion.png`

**Contexto:** Referências visuais para o Letra (workspace-centric, hexagonal, v1).

---

## Padrões observados (comuns aos dois)

| Padrão | Como aparece | Relevância para Letra |
|--------|-------------|----------------------|
| **Sidebar esquerda como âncora** | Navegação principal sempre visível, não some ao scroll | TUI do Letra (`letra workspace list`, `letra status`) pode usar sidebar ASCII fixa |
| **Seletor de contexto no topo** | Dropdown ou título do projeto/workspace atual | `letra workspace switch` → mostrar nome do workspace ativo em todo momento |
| **Status visual por avatar/cor** | Cada agente/ator tem cor e ícone fixos | Stages do SDLC (Spec, Code, Review, Security) merecem cores fixas |
| **Board/Kanban como vista canonical** | Colunas: Backlog → Pronto → Em andamento → Revisão → Concluído | Stage do SDLC é literalmente isso. Pode reaproveitar a estrutura |
| **Feed de interações à direita** | Timeline de ações/chat | Perfeito para `letra review` — mostrar comentários, aprovadores, timestamps |
| **Métricas em donut/barra** | Progresso geral, atividades por status, agentes online | Mesmas métricas do Letra: cycle time, review wait, throughput |
| **Tabs para alternância de visão** | Kanban / Timeline / Arquivos / Config | Letra: `letra flow` (board) / `letra metrics` (timeline) / `letra repo` (arquivos) |
| **Ações primárias no topo** | Botão "+ Nova Atividade" | `letra flow start`, `letra review`, `letra pr` como botões de ação no dashboard |
| **Input de resposta inline** | "Responder nessa interação..." | No `letra review`, comentário direto no diff |

---

## Divergências (qual escolher para Letra)

| Dimensão | AgentWork (Astro) | Pitagor (Orion) | Letra deve... |
|----------|-------------------|-----------------|---------------|
| **Metáfora** | Fluxo de agentes colaborando (serial) | Kanban de demandas (paralelo) | **Kanban** (mais próximo de stages lineares) |
| **Complexidade** | Alto (5 agentes, cores, setas, timeline) | Médio (colunas, cards, barra lateral) | **Médio** — evita over-design na v1 |
| **Foco** | Visualização de processo | Execução e movimentação | **Ambos** — board + timeline |
| **Tipografia** | Display font para títulos, cards com sombra | Limpo, sans-serif, whitespace generoso | **Pitagor** — mais próximo de Vercel/Linear |
| **Acessibilidade** | Cores distintas por agente | Contraste bom, ícones + texto | Seguir Pitagor |

---

## Aplicação direta no Letra

### Dashboard (`letra` / `letra status`)
```
┌─────────────────────────────────────────────────────┐
│ letra.   Workspace: pix-credito   [switch] [config] │
├──────────┬──────────────────────────┬───────────────┤
│ Workspaces│  Fluxo SDLC             │ Interações    │
│          │  ┌─────┬─────┬─────┐    │ recentes      │
│ > pix-   │  │Spec │Code │Review│   │               │
│   credito│  │ ✓   │ ⟳   │      │   │ 10:32 PR #142 │
│          │  └─────┴─────┴─────┘    │ 10:45 approved│
│   auth-  │  Gates: spec-review ✓   │               │
│   redesign│       code-review ⟳    │               │
│          │                          │               │
│ + novo   │  Métricas                │               │
│          │  Cycle: 2.3d  Rev: 4.2h │               │
└──────────┴──────────────────────────┴───────────────┘
```

### `letra review` TUI
- Diff à esquerda (como Pitagor)
- Checklist + comentários à direita (como AgentWork feed)
- Ações: Approve / Request Changes / Comment
- Status visuais por cor (verde = aprovado, amarelo = atenção, vermelho = bloqueado)

---

## Insights para a arquitetura

1. **Workspace é o contexto canônico** — ambos mostram o nome do projeto no topo, sempre visível. Letra deve fazer o mesmo com o workspace ativo.

2. **Stage = coluna + cor + ícone** — mapeamento direto:
   - Spec Draft → roxo
   - Code → azul
   - Review → amarelo
   - Security → laranja
   - Done → verde

3. **Gate = indicador na coluna** — se o gate `spec-review` está pendente, a coluna Spec tem um ícone de cadeado ou `⏳`.

4. **Interações são first-class** — tanto AgentWork quanto Pitagor tratam ações/comentários como cidadãos de primeira classe. No Letra, `review comments` e `gate approvals` são entidades do core, não só texto solto.

5. **Progresso = função de atividades concluídas** — donut chart ou barra simples. Letra pode usar:
   - `(stages completados) / (total de stages) * 100`
   - Ou weighted: cada stage tem peso diferente (Spec=10%, Code=30%, Review=30%, Security=20%, Done=10%)

---

## Próximo passo sugerido

Quer que eu:
1. **Desenhe o dashboard do Letra** (mockup TUI denso) baseado nessas referências?
2. **Defina as cores e ícones dos stages SDLC** antes de ir para o schema?
3. **Volte para os mockups do wizard** e ajuste algo com base no que vimos aqui?
