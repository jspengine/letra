## Acceptance Criteria

- [x] **Placeholder string[]**: `dead-icons.ts` autoFix adiciona `"iconName": ["M12..."]` em vez de `"iconName": () => <svg...>`
- [x] **ICON_DEF_PATTERN corrigido**: Regex muda de `\(` para `\[` para capturar definições no ICONS map; também suporta nomes com e sem aspas
- [x] **Teste de formato**: Teste verifica que autoFix adiciona placeholder no formato `string[]` e o build não quebra
- [x] **Snapshot de rollback**: Se autoFix rodou antes do bug, undo restaura o arquivo ao estado anterior (já coberto pelo engine)
