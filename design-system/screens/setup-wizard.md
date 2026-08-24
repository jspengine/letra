# SetupWizard & PersonalizationWizard

**Arquivos**: `packages/client/src/components/SetupWizard/InlineSetupWizard.tsx`, `PersonalizationWizard.tsx`
**Propósito**: Setup inicial do Letra — configurar workflow, agentes, adapters e personalização.

## Layout (InlineSetupWizard)
- Multi-step: name → directories → adapter selection → review
- Seletor de raiz de workspace
- Prompt de agente customizado por adapter
- Review final + confirmação

## Layout (PersonalizationWizard)
- Configuração de estágios do workflow
- Adicionar/remover/reordenar estágios
- Zonas (todo/doing/done)
- Definição de nome por estágio

## Elementos principais
- Step navigation
- Directory/file tree browser
- Agent prompt preview por adapter
- Stage CRUD (add/remove/reorder)

## Tokens usados
`--background`, `--border`, `--foreground`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--success`, `--success-foreground`, `--surface-1`

## Conformidade LDL
- [x] Setup guiado (alinhado com "clareza operacional")
- [x] Cores semânticas para sucesso
- [ ] Raw `<button>` e `<input>` generalizados — migração necessária
- [ ] Stage badges com classes Tailwind hardcoded (`border-amber-500/30`) — devem usar tokens
- [ ] `cn` importado de `../../lib/utils`
