# Letra Dev Loop

Fluxo oficial do projeto letra. Siga na ordem: pulse -> context -> focus -> spec.

## Pré-sessão
- Rode `letra pulse`
- Leia `AGENTS.md`, `context.md`, `focus.md`, `specs/<foco>`
- Não mova `focus.md` manualmente; use `letra focus`

## Regras fixas
- Use `letra flow move ... --auto`; nunca use `--force`
- Registre logs com `letra log add ... --item <ITEM>`
- Marque ACs com `letra ac done <AC> --spec <spec>`
- Não transite estágios sem aprovação humana
- Só mova para Code após aprovação da spec
- Após criar a spec, faça release imediato do item e aguarde aprovação humana antes de Code
- Quando não houver mais estágios, mova para Done manualmente

## Regras de branch e release
- Nunca fazer commit direto em `main`
- Toda linha de trabalho deve sair de `development`
- Para cada item/feature, crie uma branch `feature/{nome-feature}`
- Desenvolva, valide e commit **apenas** dentro dessa `feature/*`
- Quando estiver pronta, abra um PR `feature/* -> development`
- Após revisão/merge na `development`, o release deve ser gerado a partir dela

## Release / Publish (regra obrigatória)
- O publish **deve** ser feito a partir de um checkout limpo de `main`
- Passos:
  1. `git checkout main`
  2. `git clean -fd` (só remove arquivos não rastreados não-ignorados; preserva `.gitignore`)
  3. `git checkout .` (descarta alterações locais em arquivos tracked)
  4. `git pull origin main`
  5. Confirme `package.json` e `packages/<pkg>/package.json` com a versão da tag
  6. `npm -w packages/<pkg> run typecheck` (ex: `npm -w packages/cli run typecheck`)
  7. `npm -w packages/<pkg> run test`
  8. `npm publish --workspace packages/<pkg> --access public`
- Nunca publique a partir de uma working tree suja
- Se o npm rejeitar por versão existente, confira se já foi publicado antes e não repita publish
- Tag e publish devem usar a mesma versão; atualize package.json **antes** de publicar

## Checklist de publish
- [ ] Checkout limpo de `main`
- [ ] Typecheck verde (somente workspaces com script)
- [ ] Testes verdes
- [ ] Pacote versionado corretamente
- [ ] Publicação confirmada no npm
