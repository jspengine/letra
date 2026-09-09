# Launch site do Letra

Aplicação estática do lançamento público do Letra no GitHub Pages.

## Estrutura

- `public/` contém a página publicada e seus ativos.
- `evidence/` contém as fontes das demonstrações reproduzíveis.
- `design.md` registra a narrativa e o contrato de experiência.

## Validar localmente

Na raiz do repositório, execute:

```sh
npm run launch-site:check
```

O workflow `.github/workflows/pages.yml` executa a mesma verificação e publica somente `apps/launch-site/public` quando a alteração chega à `main`.
