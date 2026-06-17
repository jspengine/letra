# Constitution

> Regras não-negociáveis do projeto Letra
> Updated: 2026-06-15

## Arquitetura

- Adapter layer desde o dia 1 — nunca travar em uma IDE
- Formato `.letra/` é a fonte da verdade, não o código
- CLI deve ser extensível via plugins
- **Separação de domínios**: `validation/` (formato e conteúdo de specs) e `diagnostics/` (drift entre specs, código e workflow) são módulos distintos e não devem se importar mutuamente
- **Shared modules**: código usado por mais de um detector ou comando DEVE ser extraído para módulo compartilhado em `diagnostics/shared/` ou `validation/`. PROIBIDO duplicar `searchInSource`, `walkDir`, `loadSpecs` ou funções equivalentes

## Código

- TypeScript estrito (`strict: true` no tsconfig)
- Biome para linting e formatação
- Testes para toda lógica de parsing e validação
- Zero dependencies desnecessárias — cada dependency precisa de justificativa
- **Thin wrappers**: Commands CLI (arquivos em `commands/`) DEVEM ser thin wrappers com no máximo 100 linhas que orquestram chamadas a módulos shared. Lógica de domínio NUNCA deve estar em comandos
- **Funções puras**: Shared modules DEVEM exportar funções puras — sem estado global, sem efeito colateral, testáveis isoladamente
- **Responsabilidade única**: Cada detector, comando e módulo faz UMA coisa. Se um arquivo tem mais de uma responsabilidade clara, DEVE ser dividido
- **Template-driven**: Adaptadores (formatters.ts) geram strings a partir de dados — sem lógica de negócio. Dados são preparados por builders separados

## Specs

- Thin specs: máximo 1 página por feature
- Markdown checklist para acceptance criteria
- Sem pseudo-código nas specs
- Toda spec deve ter: Outcome, Constraints, Exclusions, Acceptance Criteria, Context

## Workflow

- Spec atualizada como parte do Definition of Done
- PR sem spec atualizada = reject
- Dogfood: Letra é construído com Letra

## Manutenibilidade

- **Complexidade ciclomática**: Nenhuma função pode exceder cyclo 10. Acima disso DEVE ser refatorada em funções menores
- **Split threshold**: Arquivos com cyclo total > 30 DEVEM ser candidatos a splitting
- **Tamanho máximo**: Detectores novos no máximo 80 linhas; commands CLI no máximo 100 linhas
- **Anti-padrões proibidos**:
  - Routing monolítico (cadeias if/else if com mais de 5 endpoints) — usar Router Map pattern
  - Validação inline duplicada em endpoints HTTP — usar módulo `validation/`
  - Lógica de domínio nos comandos CLI — extrair para módulo shared
  - Duplicação de walkDir/searchInSource — usar `diagnostics/shared/file-search.ts`

## Segurança

- Nunca incluir secrets, tokens ou chaves no repositório
- Binário standalone para distribuição a não-devs
