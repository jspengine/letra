# Spec — Validate Watch

## Outcome

Usuário roda `letra validate --watch` e o CLI monitora mudanças nas specs, re-executando validação automaticamente a cada alteração. Feedback contínuo sem re-digitar o comando.

## Constraints

- Usar `fs.watch` da Node.js API (sem dependências externas como chokidar)
- Debounce de 300ms entre alterações para evitar avalanche em saves parciais
- Manter todo o output do validate normal, apenas re-executar o ciclo
- Respeitar `.gitignore` — não monitorar arquivos ignorados

## Exclusions

- **Não é hot-reload**: Apenas re-execução do validate, sem reiniciar processo
- **Sem notificações desktop**: Apenas output no terminal

## Acceptance Criteria

- [ ] **Flag --watch**: `letra validate --watch` inicia em modo monitoramento.
- [ ] **Re-executa em mudança**: Alterar qualquer `spec.md` re-executa validate automaticamente.
- [ ] **Debounce**: Múltiplas alterações em rápida sucessão agrupam em uma única validação (300ms).
- [ ] **Clean exit**: Ctrl+C encerra o watch sem erros.
- [ ] **Ignora .gitignore**: Arquivos em pastas ignoradas não disparam validação.

## Context

O maior ponto de atrito hoje é o ciclo "edita spec → roda validate manualmente → volta pra editar". Com watch, o feedback é contínuo, aproximando a experiência de um compilador ou linter em modo watch. Essential para adoção por devs que já esperam esse padrão (Vitest, Biome, tsc --watch).
