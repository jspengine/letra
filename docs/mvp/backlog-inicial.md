# Backlog inicial do MVP (M0 e M1)

Lista usada pela skill `letra-onboard` para cadastrar o workspace `letra-mvp`.
Fonte: plano de execução do MVP (22/11/2026). Um item por linha, na ordem de execução.

## M0 — Preparação

- [M0] Linha de base registrada: 896 testes passam, 62 falham, 3 erros de typecheck, 136 erros de lint (Linux, 22/11)
- [M0] CI roda npm test e typecheck em todo push; workflows de áreas congeladas só rodam quando suas pastas mudam
- [M0] Corrigir as 21 falhas de teste do núcleo (orchestrator, flow-serve, workspace) e os 3 erros de typecheck
- [M0] Limpar resíduos do repositório: worktrees órfãos, debug.log, tsconfig.tsbuildinfo, .tmp, pastas de build do Storybook e do Playwright
- [M0] Esconder do board as telas congeladas (Conhecimento e regras, Agentes, configuração avançada)
- [M0] Registrar três decisões: modelo de evidência, modelo de gate (decisão por item) e modelo de executor (AgentRunner)
- [M0] Levar os 18 commits locais do branch feature/external-executor-protocol para a main via PR

## M1 — Governança fechada

- [M1] Servidor do board escuta só em 127.0.0.1
- [M1] Sessão humana emitida só para conexões locais; aprovação sem sessão válida é recusada
- [M1] Remover o comando gate approve e o status global de gate; aprovação só por decisão por item com identidade humana
- [M1] Redirecionar ou remover os comandos flow legados (claim, release, handoff, ac, edit) e demais escritas fora das operações de domínio
- [M1] Dados do Letra externos por padrão no init
- [M1] Teste de regressão: agente simulado não consegue aprovar gate nem mover item sem claim
