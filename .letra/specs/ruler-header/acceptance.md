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
