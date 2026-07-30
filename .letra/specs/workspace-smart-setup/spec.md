# Spec: Configuração Inteligente de Workspace

> Updated: 2026-07-03

## Outcome

O usuário cria um workspace a partir de uma pasta inicial, revisa os targets e ferramentas agênticas detectados e aprova uma instalação transparente: um harness canônico no workspace e adapters leves somente nos targets escolhidos.

## Constraints

- `Workspace` permanece como único agregado raiz; diretórios vinculados são `targets`.
- O harness é criado uma única vez e permanece como autoridade canônica.
- Nenhum arquivo é escrito antes de uma prévia e aprovação humana explícita.
- Detecções são sugestões editáveis, nunca decisões silenciosas.
- Toda escrita informa criação, atualização, conflito e estratégia de rollback.
- Adapters devem ser selecionáveis por target e gerados pelo mecanismo oficial.
- A experiência deve substituir os fluxos de setup duplicados sem quebrar workspaces existentes.
- A UI deve ser shadcn-first, responsiva, acessível e consistente em light/dark.

## Exclusions

- Instalação de IDEs, extensões ou ferramentas agênticas.
- Clonagem de repositórios remotos.
- Execução autônoma de agentes durante o setup.
- Templates de domínio além dos disponíveis no harness ativo.
- Sincronização remota ou multiusuário.

## Acceptance Criteria

- [x] **AC1 — Entrada simples**: o usuário informa nome da solução e pasta inicial; o Letra valida acesso e inicia análise sem exigir distinção entre diretório de trabalho e pastas-alvo.
- [x] **AC2 — Descoberta explicável**: a análise propõe targets, stack e ferramentas detectadas, apresentando evidências e permitindo incluir, remover ou renomear targets.
- [x] **AC3 — Ferramentas por target**: o usuário confirma quais adapters serão instalados em cada target por uma matriz editável, com estados detectado, selecionado e indisponível.
- [x] **AC4 — Harness central**: a prévia demonstra que existe um único harness canônico e que cada arquivo nos targets é um adapter derivado ou link rastreável.
- [x] **AC5 — Plano de mudança**: antes da confirmação, o Letra lista arquivos a criar, atualizar, preservar ou bloquear por conflito, com diff disponível quando houver conteúdo existente.
- [x] **AC6 — Aprovação e rollback**: somente a confirmação final executa o plano; a operação é transacional, registra evidência e oferece rollback das alterações realizadas.
- [x] **AC7 — Jornada consolidada**: os fluxos atuais de criação são substituídos por uma única experiência reutilizável no primeiro acesso e em “Novo workspace”.
- [x] **AC8 — Qualidade operacional**: testes cobrem detecção, edição da proposta, matriz por target, conflitos, falha parcial, rollback, teclado, responsividade e temas light/dark.

## Context

O setup atual exige decisões técnicas antecipadas, mantém duas implementações e aplica ferramentas globalmente. A nova experiência combina descoberta automática, configuração manual opcional e revisão humana, preservando os princípios “Harness is Authority” e “Nothing is Magic”.
