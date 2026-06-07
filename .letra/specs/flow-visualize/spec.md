# Spec: flow visualize

## Outcome
Usuário gera um diagrama Mermaid do workflow atual a partir do terminal, visualizando a sequência de estágios e a distribuição de itens.

## Constraints
- Gera saída Mermaid pura no stdout (pode ser copiada para Mermaid Live Editor ou renderizada via CLI)
- Aceita `--output flowchart.md` para salvar em arquivo
- Diagrama mostra: estágios como caixas, setas entre estágios, contagem de itens por estágio
- Sem dependências externas de renderização — só texto Mermaid
- Funciona sem workflow.json? Exibe mensagem clara

## Exclusions
- Renderização gráfica real (PNG/SVG) — o usuário usa ferramentas externas
- Diagramas interativos ou clicáveis

## Acceptance Criteria
- [ ] `letra flow visualize` gera saída Mermaid no terminal
- [ ] `letra flow visualize --output flowchart.md` salva em Markdown com ```mermaid
- [ ] `letra flow visualize --output diagram.html` salva página HTML standalone (Mermaid.js via CDN)
- [ ] Sem `--output`: exibe hint "Copy to https://mermaid.live/edit#" para renderizar
- [ ] Diagrama inclui todos os estágios com nomes e setas
- [ ] Diagrama mostra contagem de itens por estágio
- [ ] Sem workflow: exibe mensagem "No workflow found"
- [ ] Testado localmente antes do PR

## Context
Feature P1 do Flow MVP. Usuário quer compartilhar o workflow visualmente com o time.
