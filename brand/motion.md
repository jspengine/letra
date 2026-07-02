# Motion — Letra

## Princípio

Movimento em Letra comunica **execução coordenada**, não espetáculo.

## Comportamentos preferenciais

- nós pulsando de forma sutil
- linha avançando etapa a etapa
- highlight correndo até o losango final
- feedback de status com fade curto

## Ritmo

- rápido o suficiente para parecer responsivo
- calmo o suficiente para transmitir confiança

## Duração recomendada

| Caso | Duração |
|---|---|
| hover | `120–160ms` |
| focus ring / state | `150–200ms` |
| progress / pipeline | `240–400ms` |
| transição de painel | `180–240ms` |

## Curvas

- padrão: `cubic-bezier(0.2, 0.8, 0.2, 1)`
- entrada curta: `ease-out`
- feedback operacional: sem overshoot exagerado

## O que evitar

- particles
- flashes intensos
- neon pulsando
- paralaxe decorativa
- bounce em excesso

## Motion tokens

```css
--motion-fast: 140ms;
--motion-base: 180ms;
--motion-slow: 280ms;
--motion-emphasis: cubic-bezier(0.2, 0.8, 0.2, 1);
```
