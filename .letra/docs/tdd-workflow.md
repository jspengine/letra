# TDD Workflow — Guia Prático

> Como aplicar RED → GREEN → REFACTOR no código do Letra, com exemplos do domínio.
> Consulte `.letra/constitution.md` para as regras obrigatórias.

---

## 1. Antes de escrever o primeiro teste: lista de cenários

Para qualquer task (nova feature, bugfix, refactor), escreva primeiro a lista de cenários. Exemplo para `letra flow move ITEM-1 --to code`:

- [ ] **Happy path:** move item de `design` para `code`, atualiza `updatedAt`.
- [ ] **Stage inválido:** falha com erro claro se stage não existe.
- [ ] **Stage proibido:** não permite pular estágio (ex.: `backlog` → `review` direto) sem flag.
- [ ] **Item com spec:** sincroniza `focus.md` com a spec vinculada.
- [ ] **Invariante:** `items` nunca fica vazio após move (é o mesmo array, apenas campo alterado).
- [ ] **Idempotência:** chamar `move` duas vezes para o mesmo estágio não quebra.

Essa lista é o **contrato da implementação**. Ela guia o design e garante cobertura.

---

## 2. Ciclo RED → GREEN → REFACTOR

Sempre siga a ordem. NÃO escreva código de produção antes do teste falhar.

### Exemplo 1: Regra de transição de estágio (core)

**Domínio:** `core/src/workflow/engine.ts`

#### RED
Escreva o teste primeiro:

```ts
// core/src/workflow/engine.test.ts
import { describe, it, expect } from "vitest";
import { canMove } from "./engine.js";

describe("canMove", () => {
  it("allows move from design to code (next stage)", () => {
    const stages = [
      { id: "backlog", order: 0 },
      { id: "design",  order: 1 },
      { id: "code",    order: 2 },
      { id: "review",  order: 3 },
      { id: "done",    order: 4 },
    ];
    expect(canMove("design", "code", stages)).toBe(true);
  });

  it("blocks jump from backlog to review", () => {
    const stages = [ /* igual acima */ ];
    expect(canMove("backlog", "review", stages)).toBe(false);
  });

  it("returns false for non-existent target stage", () => {
    const stages = [ /* igual acima */ ];
    expect(canMove("design", "unknown", stages)).toBe(false);
  });
});
```

Execute: `npm run test:core` → teste **falha** (função ainda não existe ou stubbed errado).

#### GREEN
Implemente o mínimo para passar:

```ts
// core/src/workflow/engine.ts
export function canMove(from: string, to: string, stages: Stage[]): boolean {
  if (from === to) return false;
  const fromIndex = stages.findIndex((s) => s.id === from);
  const toIndex   = stages.findIndex((s) => s.id === to);
  if (fromIndex === -1 || toIndex === -1) return false;
  // Permite apenas stages adjacentes, exceto done
  return Math.abs(toIndex - fromIndex) === 1;
}
```

Teste agora **passa**.

#### REFACTOR
Limpe sem alterar comportamento. Ex.: extraia mapeamento de índices,Documente invariantes:

```ts
export function canMove(from: string, to: string, stages: Stage[]): boolean {
  const orderMap = new Map(stages.map((s, i) [s.id, i]));
  const fromOrder = orderMap.get(from);
  const toOrder   = orderMap.get(to);
  if (fromOrder == null || toOrder == null) return false;
  if (from === to) return false;
  return Math.abs(toOrder - fromOrder) === 1;
}
```

Testes continuam passando.

---

### Exemplo 2: Sync de foco após move (core + adapter)

**Domínio:** `core/src/focus/sync.ts`

#### RED
Escreva o teste primeiro:

```ts
// core/src/focus/sync.test.ts
import { describe, it, expect, vi } from "vitest";
import { syncFocusFromItem } from "./sync.js";

describe("syncFocusFromItem", () => {
  it("writes focus.md with spec name and item id", async () => {
    const fs = {
      writeFileSync: vi.fn(),
    } as any;
    const log = { entry: vi.fn() } as any;

    await syncFocusFromItem({
      root: "/project",
      spec: "checkout-pix",
      itemId: "ITEM-12",
      fs,
      log,
    });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/project/.letra/focus.md",
      expect.stringContaining("# checkout-pix"),
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/project/.letra/focus.md",
      expect.stringContaining("**Item**: ITEM-12"),
    );
  });

  it("does nothing when spec is empty", async () => {
    const fs = { writeFileSync: vi.fn() } as any;
    const log = { entry: vi.fn() } as any;

    await syncFocusFromItem({
      root: "/project",
      spec: "",
      itemId: "ITEM-12",
      fs,
      log,
    });

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
```

Teste falha porque `syncFocusFromItem` não existe.

#### GREEN
Implemente:

```ts
// core/src/focus/sync.ts
export async function syncFocusFromItem({
  root,
  spec,
  itemId,
  fs,
  log,
}: {
  root: string;
  spec: string;
  itemId: string;
  fs: { writeFileSync: (p: string, c: string) => void };
  log: { entry: (root: string, action: string, msg: string) => void };
}) {
  if (!spec) return;
  const content = `# ${spec}\n\n**Item**: ${itemId}\n`;
  fs.writeFileSync(join(root, ".letra", "focus.md"), content);
  log.entry(root, "focus_sync", `Synced to ${spec} via ${itemId}`, { itemId });
}
```

Teste passa.

#### REFACTOR
- `fs` e `log` são dependências injetadas — ótimo para teste.
- Extraia template de conteúdo para função privada se crescer.
- Nenhuma regra de negócio moveu para cá: apenas orquestração de escrita + log.

---

### Exemplo 3: CLI thin wrapper (superfície CLI)

**Domínio:** `cli/src/commands/flow/move.ts`

#### RED
Teste de integração que simula CLI:

```ts
// cli/src/commands/flow/move.test.ts
import { describe, it, expect, vi } from "vitest";
import { flowMoveAction } from "./move.js";

describe("flowMoveAction (CLI)", () => {
  it("moves item and calls core engine", async () => {
    const moveItem = vi.fn().mockResolvedValue(undefined);
    const regenerate = vi.fn().mockResolvedValue(undefined);

    await flowMoveAction("/tmp/project", "ITEM-1", {
      to: "code",
      auto: false,
      force: false,
      moveItem,
      regenerateAdapters: regenerate,
    });

    expect(moveItem).toHaveBeenCalledWith(
      "/tmp/project",
      "ITEM-1",
      expect.objectContaining({ targetStage: "code" }),
    );
  });
});
```

Teste falha porque `flowMoveAction` não recebe `moveItem` como arg (hoje chama core direto).

#### GREEN
Altere assinatura para receber dependências (inversão):

```ts
// cli/src/commands/flow/move.ts
export async function flowMoveAction(
  root: string | undefined,
  itemId: string,
  opts: { to?: string; auto?: boolean; force?: boolean },
  deps: {
    moveItem: (root: string, id: string, opts: any) => Promise<void>;
    regenerateAdapters?: (root: string) => Promise<void>;
  } = {
    moveItem: defaultMoveItem, // importa core
    regenerateAdapters: defaultRegenerate,
  },
) { /* usa deps.moveItem */ }
```

Teste passa. Produção continua funcionando (usa defaults). Teste de integração valida orquestração.

#### REFACTOR
- Garanta que defaults são injetados em runtime, não em teste.
- Se o arquivo crescer além de 80 linhas, extraia `validateMoveOptions` para utils.

---

## 3. Checklist rápido antes de codar toda task

1. [ ] Lista de cenários (happy, edge, erro, invariante) esboçada.
2. [ ] Testes de unidade escritos para cada cenário **antes** da implementação.
3. [ ] `npm run test` falha no cenário novo (RED confirmado).
4. [ ] Implementação mínima feita (GREEN).
5. [ ] Todos os testes passam.
6. [ ] Código limpo, sem duplicação, sem lógica em lugar errado (REFACTOR).
7. [ ] Se tocou em `core/`, adicionou/ajustou testes de contrato e snapshot.

---

## 4. Edge cases comuns no domínio Letra

Use como lista de inspeção quando projetar testes:

- **Workflow:** `workflow.json` ausente, stages duplicados, `specLinks` com path inválido.
- **Items:** `id` vazio, `stage` inexistente, `spec` vinculada a path deletado.
- **ACs:** número inválido (`0`, `-1`, `"abc"`), AC já concluída.
- **Focus:** `spec` vazia, `.letra/focus.md` sem permissão de escrita.
- **Health:** `health-record.json` corrompido, entrada com id malformado.
- **Detectors:** repositório sem `.ts`/`.tsx`, spec `.md` vazio.
- **Adapters:** `TOOL_TARGETS` vazio, caminho custom sem permissão.

---

## 5. Anti-patterns proibidos

- **Testar só happy path.** Sem edge cases, a regressão aparece em produção.
- **Testes frágeis** que dependem de ordem de objeto, timestamp exato ou conteúdo arbitrário. Use datas fixas (`vi.useFakeTimers`) e objetos determinísticos.
- **Green com over-engineering.** No GREEN, implemente o mínimo. Qualquer abstração extra é para o REFACTOR.
- **Pular RED.** Se o primeiro teste já passou, você não testou nada novo. Reescreva o teste para falhar primeiro.
- **Testes duplicando lógica.** O teste verifica **comportamento**, não repete a implementação.
- **Commit sem testes.** Linha nova sem teste correspondente é código não entregue.

---

## 6. Referências rápidas

- TDD clássico: Kent Beck, *Test-Driven Development: By Example*
- TDD para código legado: Michael Feathers, *Working Effectively with Legacy Code*
- Quando em dúvida: volte aos cenários. Se não consegue escrever o teste, o design é que está errado.
