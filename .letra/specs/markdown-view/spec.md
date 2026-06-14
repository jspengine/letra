# Spec: markdown-view

> Updated: 2026-06-14

## Outcome

Componente `MarkdownView` auto-contido que ofrece experiência rica de leitura de markdown com régua de progresso, navegação por seções e ações.

## Constraints

- Zero dependências externas — usa apenas React hooks e DOM API
- O componente gerencia todo o scroll internamente
- A régua fica SEMPRE visível (fora do container de scroll)
- O scroll só acontece dentro do container de conteúdo
- Funciona em qualquer contexto (Specs, Context, Flow)

## ACs

- [ ] **Auto-contido**: Gerencia progresso, seção ativa e scroll internamente
- [ ] **Ruler fixa**: Régua sempre visível no topo, sem `position: sticky` ou `fixed`
- [ ] **Scroll isolado**: Container de conteúdo com `overflow-y: auto` é o ÚNICO elemento scrollável
- [ ] **Progresso**: Barra de progresso reflete 0-100% do scroll
- [ ] **Seções**: Dots proporcionais representam h2 headings do markdown
- [ ] **Seção ativa**: Dot maior + label quando a seção está visível
- [ ] **Ações**: Slot `actions` para botões (Editar, Validar, etc)
- [ ] **Descrição**: Prop `description` para texto curto no header
- [ ] **Props simples**: `title`, `description`, `sections`, `actions`, `children`

## Architecture

```
MarkdownView
├── RulerHeader (flex-shrink: 0, sempre visível)
│   ├── Título + descrição
│   ├── Barra de progresso
│   ├── Dots de seção
│   └── Ações (slot)
└── ScrollContainer (flex: 1, overflow-y: auto)
    └── children (Markdown content)
```

## Props

```typescript
interface MarkdownViewProps {
  title: string;
  description?: string;
  sections: { id: string; label: string }[];
  actions?: ReactNode;
  children: ReactNode;
}
```

## Usage

```tsx
<MarkdownView
  title={spec.id}
  description="Spec de funcionalidade — define objetivo, constraints, critérios de aceitação e contexto."
  sections={extractMarkdownSections(spec.content)}
  actions={
    <>
      <Button onClick={handleValidate}>Validar</Button>
      <Button onClick={handleEdit}>Editar</Button>
    </>
  }
>
  <Markdown content={spec.content} />
</MarkdownView>
```
