---
name: letra-onboard
description: Cria e prepara um workspace do Letra para a pessoa começar a trabalhar. Use quando pedirem para "criar um workspace no Letra", "começar no Letra", "fazer o onboarding do Letra" ou cadastrar um backlog inicial num workspace novo.
---

# Onboarding de workspace no Letra

Você prepara um workspace do Letra do zero para a pessoa. Ela só confirma as decisões; você executa e verifica.

## Antes de começar

1. Confirme com a pessoa, numa única pergunta:
   - o nome do workspace (ex.: `letra-mvp`);
   - a pasta do projeto que o workspace vai governar (padrão: a pasta atual);
   - se existe uma lista de itens para cadastrar (padrão: `docs/mvp/backlog-inicial.md`, se existir).
2. Descubra como chamar a CLI:
   - se `letra --version` funcionar, use `letra`;
   - se estiver no repositório do próprio Letra, use `npm -w packages/cli run dev --`.
3. Rode tudo no mesmo sistema operacional em que o workspace vive. Nunca rode a CLI pelo Linux/WSL sobre um workspace do Windows: ela grava caminhos errados.

## Passos

1. **Preservar o estado atual.** Se existir `.letra-link` na pasta do projeto, copie para `.letra-link.antigo` e diga à pessoa para onde ele apontava. Nunca apague nem altere workspaces existentes em `~/.letra/workspaces/`.
2. **Criar o workspace.** `<cli> init --workspace <nome> --yes`, na pasta do projeto.
3. **Verificar.** `<cli> status` deve mostrar o workspace novo, e `.letra-link` deve apontar para `~/.letra/workspaces/<nome>`. Se algo falhar, pare, mostre o erro e restaure `.letra-link.antigo`.
4. **Cadastrar o backlog inicial**, se houver lista. Para cada item, na ordem da lista: `<cli> flow backlog add "<descrição>"`. Não edite `workflow.json` nem nenhum arquivo do workspace à mão: toda mudança de estado passa pela CLI.
5. **Conferir.** `<cli> flow backlog list` deve mostrar todos os itens. Compare com a lista e aponte qualquer diferença.

## Ao terminar

Responda em poucas linhas:
- nome e caminho do workspace criado, e para onde apontava o link antigo;
- quantos itens foram cadastrados, com os IDs gerados;
- qualquer erro encontrado, como achado de dogfooding (o que aconteceu, comando, saída).

## Regras

- Peça confirmação antes de sobrescrever `.letra-link`; o restante dos passos não precisa de nova confirmação.
- Não aprove gates, não faça claim e não mova itens: o onboarding só cria o workspace e o backlog.
- Não invente itens além da lista recebida.
