# Especificação: Governança da Constituição no Harness

**ID:** ITEM-80  
**Descrição:** Integrar a `constitution.md` como camada de governança ativa no harness, garantindo que ela seja vista, resolvida do caminho correto via `.letra-link`, versionada e auditável pelo LLM em cada decisão crítica.

---

## Problema

A `constitution.md` define as regras não-negociáveis do Letra (ex: "human in the loop", "harness is authority", "LLM is a tool not the owner"). Ela existe no workspace externo (`C:\Users\rnasc\.letra\workspaces\letra\.letra/constitution.md`), mas existem problemas que impedem que ela funcione como governança efetiva para o LLM:

**Problema A — Resolução de caminho incorreta:** O MCP server (`server.ts`) e outras camadas usam `getLetraDir(workspaceRoot)` para ler a constituição. Quando o `workspaceRoot` é resolvido a partir do monorepo (`C:\Workspace\letra`), o sistema pode ler o `.letra/` local (onde os arquivos foram deletados) em vez do `.letra/` do target do `.letra-link` (onde a constituição real existe). Resultado: o LLM pode receber uma string vazia ou achar que não existe constituição.

**Problema B — Ausência do contexto no direction:** O `AgentDirectionSnapshot` (o "bilhete" que `get_direction` retorna) não inclui a constituição como evidência obrigatória ou referência de governança. Ela aparece como L1 file nos adapters, mas não como parte da direção que o LLM pode consumir diretamente. Consequência: o LLM que só consulta `get_direction` pode não ter a constituição disponível.

**Problema C — Sem versão vinculada ao harness:** A constituição tem versão (1.3.0) no seu conteúdo, mas não há campo no `HarnessManifest` ou no `AgentDirectionSnapshot` que indique qual versão da constituição deve ser usada com tal versão do harness. Se a constituição for atualizada, o LLM pode continuar usando uma versão desatualizada sem saber.

**Problema D — Sem registro de consulta:** Quando o LLM lê a constituição ou quando uma operação a considera, não há log no `session-log` que registre esse fato. Sem isso, não é possível auditar se o LLM realmente consultou a constituição em decisões críticas.

**Problema E — Sem cargo de bloqueio de governança:** A constituição não está integrada como pré-requisito em gates críticos. Não há gate que verifique "a constituição está disponível e foi consultada" antes de permitir avanço.

---

## Transformação desejada

1. **Resolução correta:** Quaisquer que leia a constituição deve usar a lógica de `.letra-link` para achar o arquivo no caminho correto (target do link), não no diretório local incorreto.
2. **Constituição no direction:** O `AgentDirectionSnapshot` deve incluir um campo `governanceReferences` ou `constitution` que liste a constituição (com versão, disponibilidade) como evidência de governança que o LLM deve consultar.
3. **Versão vinculada:** Adicionar no harness (ou no direction) um campo `constitutionVersion` que vincula a versão do harness à versão da constituição esperada.
4. **Registro de consulta:** Logar no `session-log` uma ação `constitution_read` sempre que a constituição for lida (via MCP, via direction, via adapter).
5. **Gates de governança (avenida futura):** Criar ou adaptar um gate que verifique constituição disponível antes de decisões críticas.

---

## Escopo

Este item cobre a resolução dos problemas A, B, C e D. O problema E (gate de governança) será tratado como extensão futura, pois exige mudança na semântica de gate enforcement.

---

## Não abrange

- Criar gate que bloqueia operação por falta de constituição (avenida futura).
- Modificar o conteúdo da constituição (isso é item separado).
- Copiar constituição para o monorepo local (pode criar drift; a preferência é usar o caminho correto do link).
- Gerir múltiplas versões da constituição em paralelo (single source of truth).

---

## História do usuário

**Como responsável pelo projeto, eu quero que o robô sempre use a Constituição vigente como referência obrigatória em decisões críticas, de forma que ele não invente regras, não ignore as regras, e nós possamos auditar quando ele as consultou.**

Isso se traduz em quatro mudanças concretas:

1. **O robô acha a Constituição sempre do lugar correto.** Hoje o robô pode estar olhando para uma estante vazia (o `.letra/` local deletado) em vez da estante onde o livreto está (o target do `.letra-link`). A spec resolve isso fazendo com que qualquer leitura da constituição siga o mesmo caminho que o resolver de workspace usa — ou seja, respeita o `.letra-link`.

2. **O robô recebe a Constituição junto com a tarefa.** Quando o humano pede uma decisão para o robô, ele recebe um bilhete com a tarefa e o contexto (o `AgentDirectionSnapshot`). Hoje esse bilhete nem sempre diz "leia a Constituição". A spec inclui a Constituição no próprio bilhete, como parte da governança, de forma que o robô a tenha mesmo que só consulte a direção.

3. **O robô sabe qual versão da Constituição está usando.** A Constituição tem número de versão (ex: 1.3.0). Se ela mudar, o robô não deve continuar usando a versão antiga sem saber. A spec inclui a versão da Constituição no direction e, se o harness tiver uma referência à versão esperada, valida se a constituição lida é a correta.

4. **Nós sabemos quando o robô leu a Constituição.** Quando o robô lê a Constituição (via MCP, via direction, via prompt de adapter), isso é registrado no diário de sessão (`session-log`). Assim podemos auditar se o robô realmente consultou a Constituição antes de decisões difíceis, e medir se isso está acontecendo com mais frequência depois da mudança.

---

## Arquitetura do contexto (como a constituição deve fluir)

```
[Workspace Externo (.letra-link target)]
└── .letra/
    ├── constitution.md (v1.3.0, Regras não-negociáveis)
    ├── context.md
    ├── glossary.md
    └── constraints.md

[MCP Server]
    └── get_direction → AgentDirectionSnapshot
        └── governanceReferences: [{ path: "constitution.md", version: "1.3.0", available: true }]
    └── get_constitution → "letra://constitution"
        └── Lê do caminho correto (resolvido via .letra-link)

[ActivityContext]
    └── mustRead via compatibility sempre inclui constitution.md

[Adapter Prompts]
    └── L1 files sempre listam constitution.md

[SessionLog]
    └── constitution_read registrado quando:
        - MCP lê o resource constitution
        - Direction é gerado com constituição disponível
        - Adapter prompt é gerado com constitution
```

---

## Métricas de sucesso

Para que a teoria de que o harness está evoluindo seja sustentável, precisamos de métricas que mostrem o que foi melhorado. Aqui estão as métricas que a spec vai habilitar:

1. **Disponibilidade da Constituição:** antes da mudança, em quantos casos o agente recebe a Constituição disponível? Depois da mudança, espera-se que o número suba (porque o caminho de leitura está correto).
2. **Visibilidade da Constituição no direction:** antes da mudança, em quantos directions a Constituição está presente? Depois da mudança, espera-se que esteja sempre presente quando disponível.
3. **Versão da Constituição vinculada:** antes da mudança, a versão da Constituição é conhecida pelo agente? Depois da mudança, sim — e podemos validar se a versão lida é a esperada pelo harness.
4. **Registro de leitura da Constituição:** antes da mudança, há registros de leitura da Constituição no session-log? Depois da mudança, sim — e podemos auditar quantas vezes a Constituição foi consultada.
5. **Indicador de indisponibilidade:** antes da mudança, quando a Constituição não está disponível, o agente recebe alguma sinalização? Depois da mudança, sim — e o agente pode pedir para o humano resolver.
