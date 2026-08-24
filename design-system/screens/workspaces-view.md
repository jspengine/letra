# WorkspacesView & WorkspaceSetupFlow

**Arquivos**: `packages/client/src/components/Workspaces/WorkspacesView.tsx`, `WorkspaceSetupFlow.tsx`
**Propósito**: Gerenciamento de workspaces — listar, criar, configurar pastas e ferramentas.

## Layout (WorkspacesView)
- Grid/lista de workspaces com cards
- Criar workspace (abre setup flow)
- Gate mode para seleção de workspace ativo

## Layout (WorkspaceSetupFlow)
- Multi-step wizard: info → directories → tools → review
- Diretórios com seletor de árvore
- Adaptadores (OpenCode, Cursor, Claude Code, etc.)
- Review + confirmação

## Elementos principais
- Workspace cards
- Wizard steps com progresso
- Tree selector de diretórios
- Adapter checklist
- Review summary

## Tokens usados
`--border`, `--error`, `--muted`, `--muted-foreground`, `--primary`, `--primary-foreground`, `--success`, `--success-foreground`, `--surface-1`

## Conformidade LDL
- [x] Wizard multi-step com progresso (alinhado com conceito de fluxo)
- [x] Cores semânticas em badges e status
- [ ] Raw `<input>`, `<select>`, `<button>` no wizard — migrar para `@letra/ui`
- [ ] Tree selector custom — sem componente nativo, pode usar shadcn/radix
- [ ] `cn` importado de `../../lib/utils` — deve ser `@letra/ui`
