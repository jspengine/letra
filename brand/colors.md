# Colors — Letra

## Paleta principal

| Cor | HEX | RGB | HSL | Papel |
|---|---|---|---|---|
| Amber | `#FFB800` | `255, 184, 0` | `43, 100%, 50%` | marca, foco, energia |
| Slate | `#0F1115` | `15, 17, 21` | `220, 17%, 7%` | estrutura, fundo, texto |
| Emerald | `#22C55E` | `34, 197, 94` | `142, 70%, 45%` | sucesso, execução |
| Blue | `#3B82F6` | `59, 130, 246` | `217, 91%, 60%` | informação |
| Red | `#EF4444` | `239, 68, 68` | `0, 84%, 60%` | erro, bloqueio |
| Purple | `#8B5CF6` | `139, 92, 246` | `258, 90%, 66%` | agentes, raciocínio |

## Neutros de apoio

| Token | HEX | Uso |
|---|---|---|
| `slate-950` | `#090B0F` | fundo profundo |
| `slate-900` | `#0F1115` | fundo principal |
| `slate-800` | `#171A21` | cards |
| `slate-700` | `#232833` | bordas elevadas |
| `slate-500` | `#6B7280` | texto secundário |
| `slate-100` | `#F3F4F6` | fundo claro |
| `white-soft` | `#F8FAFC` | wordmark em dark UI |

## Semântica

- **Amber**: energia, marca, foco, progresso
- **Slate**: profundidade, precisão, estrutura
- **Emerald**: execução, sucesso, item concluído
- **Blue**: informação, status neutro, telemetria
- **Red**: bloqueio, erro, risco
- **Purple**: agentes, IA, raciocínio coordenado

## Regras de uso

1. Amber nunca deve dominar a interface inteira; ele atua como **acento operacional**
2. Slate é a base do sistema
3. Emerald, Blue, Red e Purple entram como semântica, não como identidade principal
4. Em dark mode, contraste vem de hierarquia de superfícies, não de brilho

## CSS variables

```css
:root {
  --letra-amber: #ffb800;
  --letra-slate: #0f1115;
  --letra-emerald: #22c55e;
  --letra-blue: #3b82f6;
  --letra-red: #ef4444;
  --letra-purple: #8b5cf6;
}
```

## Combinações preferenciais

- `Slate + Amber` → identidade principal
- `Slate + White + Amber` → produto premium
- `Slate + Emerald` → execução concluída
- `Slate + Purple` → contexto de agentes

## Acessibilidade

- texto principal em dark surfaces deve usar branco suave
- Amber não deve carregar grandes blocos de texto
- estados críticos devem combinar cor + label + ícone
