# Acceptance Criteria — ruler-header

- [x] **DocumentView component**: Envolve conteúdo scrollável com sticky RulerHeader no topo.
- [x] **RulerHeader fade**: Opacidade inicia em 1.0 e reduz até 0.3 conforme o scroll progride.
- [x] **Progress bar**: Barra horizontal no ruler reflete progresso do scroll (0–100%).
- [x] **Section dots**: Dots proporcionais representam seções do documento (h2 headings).
- [x] **Active section**: Dot da seção ativa é maior e com cor primary; label da seção aparece abaixo.
- [x] **SpecsView integration**: Detail panel de spec usa DocumentView em vez de layout manual.
- [x] **ContextView integration**: Visualização de context.md, constitution.md, glossary.md e decisions usa DocumentView.
- [x] **extractMarkdownSections**: Função exportada extrai seções do markdown via regex `^##\s+(.+)`.
- [x] **Actions slot**: RulerHeader aceita `actions` ReactNode para botões como Validar/Editar.
