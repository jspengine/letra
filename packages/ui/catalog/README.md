# Letra Design System v2 — Catálogo para Agentes

Este diretório contém a referência canônica para agentes de IA consumirem/ampliarem a UI do Letra sem improviso visual.

## Leituras obrigatórias antes de codificar UI

1. `catalog.json` — lista completa de componentes, variantes permitidas, contextos e restrições.
2. `../src/index.css` — tokens canônicos: cores, tipografia, motion, radius, shadows, aliases legacy.
3. `../src/index.ts` — barrel oficial + export de tipos públicos.
4. `../src/patterns/index.ts` — re-export dos patterns para descoberta rápida.

## Regras universais (não negociáveis)

- **Sem cor hardcoded.** Sempre use tokens CSS vars declarados no catálogo.
- **Roxo (`--color-agent`) é só para IA.** Nunca em botão genérico, link, badge humano ou decoração.
- **Amarelo (`--color-primary`) é marca + atenção.** Pode ser `primary` ou `warning` leve; jamais warning genérico quando existir `--color-warning`.
- **Border radius:** usar tokens `--radius-xs`(6px) a `--radius-xl`(20px). `--radius-full` para pills, avatar, radio, switch, progress.
- **Tipografia:** `Sora` só em `text-display` e `text-h1`. Tudo o resto é `Inter`. `JetBrains Mono` só para comandos/IDs.
- **Motion:** todo estado usável precisa de `transition` com `duration-fast` + `ease-standard`. Modais/drawers: `280–320ms`.
- **Acessibilidade:** foco visível em `--color-primary`, contraste AA, `prefers-reduced-motion` respeitado.
- **Ícones:** use `<Icon>` de `@letra/ui`. Cor vem do contexto, não do ícone.
- **Composição preferencial:** prefira `Card` + `Button` + `Badge` + `Avatar` ao invés de `div` soltas.

## Caminho feliz para agentes

1. Consuma só exports públicos em `packages/ui/src/index.ts` e `packages/ui/src/patterns/index.ts`.
2. Use componentes-base para criar padrões novos; evite criar primitivos duplicados.
3. Quando adicionar componente novo, registre no `catalog.json` para manter a LLM alinhada.
4. Não altere tokens em `index.css` diretamente; proponha uma issue/change e atualize o catálogo junto.
5. Respeite o contrato de variantes/states em `catalog.json` para não introduzir estados fantasma.

## Estrutura recomendada

```
packages/ui/
  catalog/
    catalog.json
    README.md
  src/
    index.ts
    index.css
    utils.ts
    <component>.tsx
    <component>.stories.tsx
    patterns/
      <pattern>.tsx
      <pattern>.stories.tsx
```

## Manutenção

- Atualizar `catalog.json` sempre que novo componente/variante for adicionado.
- Esta versão referencia `@letra/ui 0.4.0`, DS v2 tokens, radius 6–20px, motion canônico.
