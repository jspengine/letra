# Spec — Decision New

## Outcome

Usuário roda `letra decision new <titulo>` e o CLI cria um ADR (Architecture Decision Record) em `.letra/decisions/<titulo>.md` com template preenchido, permitindo rastrear decisões arquiteturais entre sessões.

## Constraints

- Formato do ADR: Contexto → Decisão → Consequências (formato Pascal/Lightweight)
- Cada ADR é um arquivo Markdown em `.letra/decisions/`
- Título sanitizado para nome de arquivo (slug)
- Data e status "proposed" preenchidos automaticamente

## Exclusions

- **Não substitui spec**: ADR registra *decisões*, não *intenção* de features
- **Sem linking entre ADRs**: (futuro) — cada ADR é independente por ora

## Acceptance Criteria

- [x] **Comando `letra decision new <titulo>`**: Cria `.letra/decisions/<slug>.md` com template ADR.
- [x] **Template ADR**: Contém seções Contexto, Decisão, Consequências, Status, Data.
- [x] **Sanitização**: Título vira slug (ex: "Usar Commander ou Yargs" → `usar-commander-ou-yargs.md`).
- [x] **Listagem**: `letra decision list` lista todos ADRs existentes.
- [x] **Data automática**: Preenche data atual no frontmatter do ADR.

## Context

Decisões arquiteturais ficam perdidas entre sessões de agentes. Hoje usamos `lessons-learned.md` como paliativo, mas não há estrutura para registrar o contexto de uma decisão, a alternativa preterida e as consequências. ADRs resolvem isso de forma leve e portátil — puro Markdown, sem lock-in. Formato inspirado em Michael Nygard e https://adr.github.io/.
