# Spec: ruler-header

> Updated: 2026-06-22

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

## Exclusions

- IntersectionObserver para detecção de seção — usamos `getBoundingClientRect` no heading durante scroll (mais simples, sem polyfill)
- Scroll horizontal — régua é puramente horizontal, sem scroll próprio
- Animações complexas (parallax, spring) — transições CSS lineares são suficientes
- Customização de cores por tema — usa variáveis CSS existentes

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

## Context

O Ruler Header resolve três problemas de uma vez:

1. **Perda de contexto**: Ao rolar um spec grande, o usuário esquece qual seção está lendo. A régua mostra isso centralmente.
2. **Navegação cega**: Sem índice clicável, o usuário só tem a barra de rolagem. A régua dá referência visual da estrutura.
3. **Identidade visual**: Detalhes como esse diferenciam o Letra de "mais um leitor de Markdown". A régua que fadeia é uma assinatura visual.

A escolha de `getBoundingClientRect` em vez de `IntersectionObserver` é proposital: menos código, sem polyfill, controle total sobre o cálculo. O custo é uma chamada de layout síncrona por evento de scroll, que é insignificante para o volume de seções (tipicamente 5-10).
