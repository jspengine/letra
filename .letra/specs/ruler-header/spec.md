# Spec: Ruler Header — Document View Component

> Updated: 2026-06-14

## Outcome

Todo painel de leitura de documento (spec detail, context files, decision detail) usa o mesmo componente `DocumentView` com um **Ruler Header** fixo no topo. Ao rolar o conteúdo, o header fadeia suavemente (opacity 1.0 → 0.3) e uma régua horizontal com marcadores de seção desliza, dando a sensação de uma régua sendo passada sobre o texto. A seção ativa é destacada no centro da régua. O usuário sabe exatamente onde está no documento sem precisar olhar para a barra de rolagem.

## Constraints

- **Zero dependências externas** — scroll detection com `onScroll` nativo, sem IntersectionObserver polyfill
- **Sticky positioning** — `position: sticky; top: 0; z-index: 10`
- **Fade suave** — opacidade diminui linearmente com scroll: 0% scroll = opacity 1.0, 100% scroll = opacity 0.3
- **Régua proporcional** — marcadores de seção distribuídos proporcionalmente no eixo X, não por número de caracteres
- **Seção ativa** — detectada por position do heading no container scrollável
- **Reusável** — `DocumentView` é o container padrão para qualquer conteúdo Markdown em detail panel
- **Transições de 150ms ease** — para opacidade, destaque de seção, e movimento da régua

## Visual Design

### Comportamento de fade (o essencial)

O header começa 100% opaco no topo. Conforme o usuário rola o conteúdo, ele fadeia para 0.3. A régua continua visível mesmo transparente — suficiente para referência, sutil o suficiente para não distrair.

### A régua horizontal

Uma linha horizontal abaixo do título, com:
- Um `progress bar` de fundo (fill da esquerda para direita conforme scroll)
- **Marcadores (dots)** para cada seção do documento, posicionados proporcionalmente na linha
- O marcador da **seção ativa** é maior e usa cor `--primary`
- O **nome da seção ativa** aparece centralizado abaixo da régua

### Layout completo

```
┌─────────────────────────────────────────────────────┐ ← sticky, z-10
│ 🔍 flow-serve                    ▓▓▓▓▓░░░░░░  45%  │ ← título + progresso
│ ●───────●─────────●──────────●─────────●────────    │ ← régua com dots
│            Constraints (ativo)                       │ ← label da seção
├─────────────────────────────────────────────────────┤ ← border-bottom fina
│                                                      │
│  ## Outcome                                         │ ← conteúdo rolável
│  ...                                                │
│                                                     │
│  ## Constraints                                     │ ← seção ativa
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

### Estados

| Estado | Opacidade | Régua | Seção ativa |
|---|---|---|---|
| Topo (0% scroll) | 1.0 | Dots posicionados, nenhum destacado | Primeira seção |
| Rolando (10-80%) | 1.0 → 0.3 linear | Dot ativo maior, label centralizado | Muda conforme scroll |
| Fundo (100%) | 0.3 | Fill completo, último dot ativo | Última seção |
| Sem seções | 1.0 | Régua vazia (só progress bar) | Nenhuma |

## Reusabilidade

O componente `DocumentView` substitui o wrapper manual em três lugares:

| View atual | Onde é usado | O que muda |
|---|---|---|
| `SpecsView` detail panel | Layout fixo + Markdown | Vira `<DocumentView>` |
| `ContextView` content area | Markdown de context/constitution/glossary | Vira `<DocumentView>` |
| `FlowView` detail panel | Spec vinculada renderizada | Vira `<DocumentView>` |

### API do componente

```tsx
interface DocumentViewProps {
  title: string;
  sections: { id: string; label: string }[];
  actions?: ReactNode;       // edit, delete, etc.
  children: ReactNode;       // o conteúdo (Markdown, etc.)
}

interface RulerHeaderProps {
  title: string;
  progress: number;          // 0.0 a 1.0
  opacity: number;           // 0.3 a 1.0
  sections: { id: string; label: string }[];
  activeSection: string | null;
  actions?: ReactNode;
}
```

## Integração com diagnóstico na lista de specs

A `SpecsView` busca `GET /api/diagnostics` e mostra badges de diagnóstico **apenas per-spec** no card da lista:

```
[flow-serve]  ✅  valid    💡 1 AC desatualizado
[flow-mvp]    ⚠  warning
```

Diagnósticos não per-spec (diretório ausente, dead icons) continuam no badge do header.

Para isso, a engine precisa incluir `specId` nos resultados de detectores per-spec (`ac-stale`, `ac-false-pos`, `stage-drift` quando o item tem spec vinculada).

## Arquivos

```
packages/client/src/components/ui/
├── DocumentView.tsx    ← container reutilizável (RulerHeader + scroll)
├── RulerHeader.tsx     ← sticky header com fade + régua

packages/client/src/components/Specs/SpecsView.tsx
  ← adiciona fetch /api/diagnostics, badges per-spec
```

## Acceptance Criteria

- [ ] **RulerHeader fixo**: Permanece no topo durante scroll via `position: sticky`
- [ ] **Fade no scroll**: Opacidade diminui de 1.0 para 0.3 proporcional ao progresso do scroll
- [ ] **Progress bar**: Barra horizontal preenche da esquerda para direita conforme scroll
- [ ] **Marcadores de seção**: Dots na régua posicionados proporcionalmente, um por seção
- [ ] **Seção ativa destacada**: Dot da seção visível é maior e usa cor `--primary`
- [ ] **Label da seção ativa**: Nome da seção ativa aparece centralizado abaixo da régua
- [ ] **DocumentView reutilizável**: `SpecsView`, `ContextView`, `FlowView` usam o mesmo componente
- [ ] **DocumentView encapsula scroll**: Container tem `overflow-y: auto` e gerencia o estado de scroll
- [ ] **Transições suaves**: Opacidade e destaque de seção usam `transition: 150ms ease`
- [ ] **Sem dependências**: Apenas `onScroll` nativo, sem IntersectionObserver ou libs externas
- [ ] **SpecsView: diagnóstico per-spec**: Lista mostra badge com contagem de diagnósticos por spec
- [ ] **SpecsView: filtros consistentes**: Filtro "Avisos" inclui diagnósticos per-spec

## Exclusions

- IntersectionObserver para detecção de seção — usamos `getBoundingClientRect` no heading durante scroll (mais simples, sem polyfill)
- Scroll horizontal — régua é puramente horizontal, sem scroll próprio
- Animações complexas (parallax, spring) — transições CSS lineares são suficientes
- Customização de cores por tema — usa variáveis CSS existentes

## Context

O Ruler Header resolve três problemas de uma vez:

1. **Perda de contexto**: Ao rolar um spec grande, o usuário esquece qual seção está lendo. A régua mostra isso centralmente.
2. **Navegação cega**: Sem índice clicável, o usuário só tem a barra de rolagem. A régua dá referência visual da estrutura.
3. **Identidade visual**: Detalhes como esse diferenciam o Letra de "mais um leitor de Markdown". A régua que fadeia é uma assinatura visual.

A escolha de `getBoundingClientRect` em vez de `IntersectionObserver` é proposital: menos código, sem polyfill, controle total sobre o cálculo. O custo é uma chamada de layout síncrona por evento de scroll, que é insignificante para o volume de seções (tipicamente 5-10).
