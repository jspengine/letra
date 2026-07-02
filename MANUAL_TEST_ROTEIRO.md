# Roteiro de Testes Manuais

## Pré-requisitos

```bash
cd C:\Workspace\letra
npm run build       # build completo
```

---

## 1. Workspace Discovery (item-1)

### 1.1 Criar workspace isolado
```bash
letra init --workspace meu-teste
```
**Esperado:**
- Mensagem "Workspace "meu-teste" created"
- Caminhos: `~/.letra/workspaces/meu-teste/` e `letra.manifest.json` no cwd
- `~/.letra/harness/v0.1.0/` populado

### 1.2 Verificar workspace
```bash
letra status
```
**Esperado:**
- Mostra workspaceId, templateId, harnessVersion, repositories
- Se `letra.manifest.json` não existir: lista todos workspaces de `~/.letra/workspaces/`

### 1.3 Manifest gerado
```bash
type letra.manifest.json
```
**Esperado:** JSON com `projectId`, `workspaceId`, `templateId`, `harnessVersion`, `repositories[]`, `gates[]`

### 1.4 Workspace duplicado
```bash
letra init --workspace meu-teste
```
**Esperado:** Erro: "Workspace "meu-teste" already exists"

---

## 2. SDLC Template + Gates (item-2)

### 2.1 Flow start com template
```bash
letra flow start --template sdlc
```
**Esperado:**
- Cria `.letra/workflow.json` silenciosamente (sem prompts)
- Usa nome do diretório como workflow name
- SDLC stages: Backlog → Spec Draft → Spec Review → Code → Code Review → Security → Ready to PR → Done

### 2.2 Flow init --quick (alias)
```bash
# em um diretório temporário:
mkdir C:\temp\test-letra
cd C:\temp\test-letra
letra flow init --quick
```
**Esperado:** Mesmo que `flow start` — cria workflow sem prompts

### 2.3 Gate human-approved-spec
```bash
letra flow backlog add "Teste gate"
letra flow move ITEM-1 --to spec-review
```
**Esperado:** "Gate bloqueante: Aprovação Humana (Spec)" bloqueia o movimento sem `--force`

### 2.4 Gate human-approved-code
```bash
letra flow move ITEM-1 --to code-review --force
```
Se usar `--force` para bypassar AC check:
**Esperado:** Gate bloqueia com "Aprovação Humana (Code)"

---

## 3. Letra Init Command (item-5)

### 3.1 Init interativo (TUI)
```bash
letra init
```
**Esperado:**
- Tela com logo ASCII do Letra
- Pressionar Enter avança
- Step 1: Seleção de "Tipo de projeto" com setas + Enter
- Step 2: Seleção de "Ferramenta de IA"
- Step 3: Preview com Esc pra voltar
- Step 4: Tela "Criando..." → "Criado com sucesso!"
- `.letra/` criado com context.md, constitution.md, glossary.md, specs/

### 3.2 Init com --no-tui
```bash
letra init --no-tui
```
**Esperado:** Fallback para prompts de texto (readline) — sem TUI

### 3.3 Init com --yes
```bash
letra init --yes
```
**Esperado:** Cria `.letra/` com defaults (sem prompts, sem TUI)

### 3.4 Init com --serve
```bash
letra init --serve
```
**Esperado:** Se `.letra/` já existe, abre web UI. Caso contrário, init + serve.

---

## 4. TUI Onboarding (item-3)

### 4.1 Logo ASCII
No TUI do `letra init`:
**Esperado:** Logo no topo:
```
   __         __
  / /_____ _/ /____  ____
 / __/ __ \`/ __/ _ \\/ __ \\
/ /_/ /_/ / /_/  __/ / / /
\\__/\\__,_/\\__/\\___/_/ /_/
```

### 4.2 Navegação setas
**Esperado:**
- Seta pra cima/baixo navega entre opções
- Enter confirma seleção
- Preview screen: Esc volta, Enter confirma

### 4.3 Preview
No step 3 do TUI:
**Esperado:** Mostra resumo: tipo de projeto + ferramenta selecionada + lista do que será criado

### 4.4 Progress indicator
Após confirmar preview:
**Esperado:** Tela "Criando..." (amarelo) → "Criado com sucesso!" (verde) → wizard fecha

---

## 5. Harness Loader (item-4)

### 5.1 API templates
```bash
# iniciar servidor web:
letra flow serve --port 3333
# em outro terminal:
curl http://localhost:3333/api/harness/templates
```
**Esperado:** JSON com template SDLC contendo stages, gates, roles, policies

### 5.2 Flow board
```bash
letra flow board
```
**Esperado:** Board com estágios e itens posicionados corretamente

---

## Limpeza

```bash
# remover workspaces de teste
rm ~/.letra/workspaces/meu-teste -r
# remover letra.manifest.json de teste
rm letra.manifest.json
```
