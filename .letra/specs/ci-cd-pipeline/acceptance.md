## Acceptance Criteria

- [x] **Lint Gate**: O CI falha se `letra lint` detectar erros nas specs.
- [x] **Test Gate**: O CI falha se os testes unitários (vitest) falharem.
- [x] **Validação de Formato**: O CI roda `tsc --noEmit` para checar tipos.
- [x] **CI em `development`**: Pipeline roda em pushes e PRs para `development`.
- [x] **CI em `main`**: Pipeline roda em pushes e PRs para `main`.
- [x] **Branch Protection**: `main` e `development` exigem PR com CI verde para merge.
