# Typography — Letra

## Fonte principal

**Sora** para branding e headlines.  
**Inter** para interface, documentação e densidade informacional.

## Por quê

- **Sora** traz geometria moderna, técnica e memorável
- **Inter** entrega excelente legibilidade para SaaS, tabelas, sidebars e conteúdo denso

## Stack recomendada

```css
--font-brand: "Sora", "Inter", system-ui, sans-serif;
--font-ui: "Inter", system-ui, sans-serif;
--font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
```

## Hierarquia

| Papel | Fonte | Peso | Tamanho sugerido | Uso |
|---|---|---|---|---|
| Display | Sora | 600 | 56–72px | hero, campanhas |
| H1 | Sora | 600 | 40–48px | páginas principais |
| H2 | Inter | 600 | 28–32px | seções |
| H3 | Inter | 600 | 22–24px | subáreas |
| Body | Inter | 400 | 16–18px | texto padrão |
| Caption | Inter | 500 | 12–13px | labels, meta |
| Mono | JetBrains Mono | 500 | 12–14px | logs, IDs, comandos |

## Regras

- branding usa **Sora** com tracking levemente fechado
- UI usa **Inter** para leitura contínua
- números de dashboard podem usar `font-variant-numeric: tabular-nums`
- evite mais de 3 pesos em uma mesma tela

## Em marketing

- títulos curtos e claros
- mais contraste de escala do que de cor
- subtítulos em Inter com peso 400 ou 500

## Em produto

- priorizar legibilidade sobre personalidade
- usar mono para comandos, IDs, diffs e telemetria
- evitar textos longos em all caps
