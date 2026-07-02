# Spec: harness-viewer

> Updated: 2026-06-23

## Outcome
O desenvolvedor consegue visualizar na Web UI a pilha exata de contexto (camadas L1 a L4) compilada pelo LETRA, facilitando o entendimento de quais instruções e critérios de aceitação estão sendo consumidos pelas ferramentas de IA no momento.

## Constraints
- A visualização deve ler dinamicamente o arquivo `.letra/focus.md` e a spec sob foco atual para compilar as camadas em tempo real.
- Deve ser otimizado para evitar requisições pesadas ao disco local.

## Exclusions
- Edição direta de prompts globais por esta visualização (deve ser tratada na configuração global).

## Acceptance Criteria
- [x] **AC1**: Componente de visualização em cascata (L1, L2, L3, L4) implementado na aba Context/Specs.
- [x] **AC2**: Camadas mostram a origem dos arquivos lidos (e.g., L1 lido de `constitution.md`).
- [x] **AC3**: Cópia rápida (Copy to Clipboard) do prompt final gerado/compilado.
- [x] **AC4**: Renderização limpa de markdown com destaque de código nos trechos de prompts.

## Context
Evitar a "caixa preta" do harness. Ao dar visibilidade de o que as LLMs lêem, reduzimos a alucinação e aumentamos a confiança do desenvolvedor no framework.
