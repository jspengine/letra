# Context

> Updated: 2026-05-01
> Owner: letra-dev

## Intent

Letra é um framework de Specification-Driven Development (SDD) agnóstico a ferramentas.
Captura direção, intenção e contexto, enriquecendo prompts de agentes de código.

## Domínio

- **Produto**: CLI + adapters + formato de memória `.letra/`
- **Público**: 1. Não-devs → 2. Devs → 3. Empresas (tarefas diversas)
- **Stack**: TypeScript, Node.js 22+, distribuído como binário standalone

## Restrições Reais

- Specs devem ser thin (máx 1 página por feature)
- Sem lock-in de IDE — o formato `.letra/` é Markdown puro
- Drift detection deve funcionar para qualquer domínio (não só código)
- Pipeline CI/CD deve falhar se spec não for cumprida

## Porquês

- Escolhemos TypeScript porque 82% dos novos pacotes npm são TS em 2026
- Escolhemos Markdown checklist porque não-devs precisam ler e escrever specs
- Escolhemos adapter OpenCode primeiro para dogfooding imediato
- Escolhemos organização GitHub dedicada para identidade de produto
