# Lessons Learned

> Erros recorrentes dos agentes, padrões que falharam, insights de construção

## 2026-05-01 — Ideação

### O que funcionou
- Pesquisar dores reais do SDD antes de definir arquitetura
- Decidir por evidências (métricas, dados) e não por intuição
- Definir ordem de adapters baseada em dogfood → early adopters → massa

### O que aprendemos
- Drift detection não pode ser code-centric — público primário são não-devs
- Obsidian nunca deve ser requisito — barreira de adoção
- TypeScript domina CLIs em 2026 (82% dos novos pacotes npm)

### Padrões a evitar
- Specs gigantes (Markdown Madness)
- Lock-in de IDE
- Spec que vira pseudo-código
