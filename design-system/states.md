# Spec de Estados de Componentes — AC5

> Atualizado: 2026-06-29
> Define os 5 estados padrão para componentes do LDL: Loading, Empty, Success, Error, Disabled.
> Critérios visuais + acessibilidade.

---

## Princípios

1. **Todo componente deve tratar os 5 estados**
2. **Estados combinam cor + ícone + label** (nunca apenas cor)
3. **Animações seguem brand motion** (`--motion-fast`/`--motion-base`, sem bounce/neon)
4. **Contraste WCAG 2.2 AA em todos os estados**

---

## 1. Loading

| Atributo | Especificação |
|---|---|
| Visual | Skeleton shimmer (gradiente animado `--surface-2` → `--surface-3` → `--surface-2`) |
| Animação | `animate-shimmer-slide` (1.2s, `--motion-emphasis`) |
| Corpo | Skeleton com proporção aproximada do conteúdo final |
| Acessibilidade | `aria-busy="true"`, role `status` |
| Alternativa | Texto "Carregando..." para leitores de tela (sr-only) |

**Tokens**: `--surface-2` (base), `--surface-3` (shimmer)

**Variações**:
- `SkeletonCard`: card inteiro esqueletado
- `SkeletonPipeline`: pipeline de estágios esqueletado
- `SkeletonAgentList`: lista de agentes esqueletada
- `SkeletonText`: linha de texto (largura variável 60–90%)
- `SkeletonAvatar`: círculo de 32–48px

---

## 2. Empty

| Atributo | Especificação |
|---|---|
| Visual | Ícone grande centralizado + título + subtítulo + CTA opcional |
| Ícone | `EmptyState` component com Icon 48px |
| Cor | `--muted-foreground` para ícone e texto |
| CTA | Botão "Criar primeiro" ou "Adicionar" (quando aplicável) |
| Acessibilidade | role `status`, aria-label descritivo |

**Tokens**: `--muted-foreground` (texto/ícone)

**Mensagens padrão**:
- Sem itens: "Nenhum item encontrado"
- Sem resultados: "Nenhum resultado para esta busca"
- Sem workflow: "Nenhum workflow configurado"
- Sem agentes: "Nenhum agente ativo no momento"

---

## 3. Success

| Atributo | Especificação |
|---|---|
| Visual | Check verde + label + duração opcional |
| Ícone | `check-circle` (16–24px) |
| Cor | `--success` (`--letra-emerald-500`) |
| Animação | Fade-in curto (`--motion-fast`, 140ms) |
| Acessibilidade | `role="status"`, `aria-live="polite"` |

**Variações**:
- Toast: `animate-slide-in-right` (painel)
- Inline: badge verde + texto
- Badge: `Badge variant="success"`

---

## 4. Error

| Atributo | Especificação |
|---|---|
| Visual | Ícone de erro + label + descrição + ação de recovery |
| Ícone | `alert-circle` ou `x-circle` (16–24px) |
| Cor | `--error` (`--letra-red-500`) |
| Fundo | `ErrorBanner` com `--surface-1` + borda `--error` |
| Acessibilidade | `role="alert"`, `aria-live="assertive"` |
| Recovery | Botão "Tentar novamente" ou link para suporte |

**Tokens**: `--error` (borda/ícone), `--surface-1` (fundo), `--font-code` (detalhe técnico)

**Regras**:
- Mensagem deve ser descritiva para o usuário, não apenas código de erro
- Erro técnico pode ser exibido em `<code>` com `--font-mono`
- Estado crítico: cor + label + ícone (brand acessibilidade rule #3)

---

## 5. Disabled

| Atributo | Especificação |
|---|---|
| Visual | Opacidade reduzida, sem interação |
| Opacidade | `0.5` sobre o valor base |
| Cor | `--text-disabled` para texto, `--border-disabled` para bordas |
| Cursor | `not-allowed` |
| Acessibilidade | `aria-disabled="true"`, tabindex `-1` |
| Tooltip | Opcional: "Disponível em breve" |

**Tokens**: `--text-disabled`, `--border-disabled`, `--border-default` com opacidade

**Não usar**: Apenas mudança de cor sem indicador visual adicional.

---

## Referência rápida

| Estado | Ícone | Cor | Animação | A11y role |
|---|---|---|---|---|
| Loading | — | `--surface-2/3` | `shimmer-slide` | `aria-busy` |
| Empty | `box` / `search` | `--muted-foreground` | `fade-in` | `status` |
| Success | `check-circle` | `--success` | `fade-in` (140ms) | `status`, `aria-live=polite` |
| Error | `alert-circle` | `--error` | `fade-in` (180ms) | `alert`, `aria-live=assertive` |
| Disabled | — | `--text-disabled` | — | `aria-disabled` |

---

## Componentes do sistema que implementam estes estados

| Componente | Loading | Empty | Success | Error | Disabled |
|---|---|---|---|---|---|
| `Card` | `SkeletonCard` | `EmptyState` | Badge | `ErrorBanner` | Opacity 0.5 |
| `Button` | spinner | — | check icon | shake | Opacity 0.5 + `not-allowed` |
| `Input` | — | placeholder | green ring | red ring + message | Opacity 0.5 |
| `Select` | — | placeholder | — | red ring | Opacity 0.5 |
| `Toast` | — | — | check + message | alert + message | — |
| `Dialog` | Skeleton form | — | confirmation | error message | — |
| `Table/List` | `SkeletonText` | "Nenhum registro" | inline badge | inline alert | row opacity |
