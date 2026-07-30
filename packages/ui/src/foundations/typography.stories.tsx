import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Foundations/Typography",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    "x-ds": {
      category: "foundation",
      status: "ready",
      tokens: ["font-display", "font-ui", "font-mono", "display-size", "body-size"],
      consumes: [],
      surfaces: ["Storybook"],
      a11y: ["readable-scale", "font-token-labels"],
      breakpoints: ["mobile", "desktop"],
    },
  },
};

export default meta;

type Story = StoryObj;

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 20,
  padding: 24,
  maxWidth: 720,
};

export const Scale: Story = {
  render: () => (
    <div style={wrap}>
      <p className="m-0 text-display text-[var(--color-text-primary)]">Display — Letra DS</p>
      <p className="m-0 text-h1 text-[var(--color-text-primary)]">Heading 1 — The quick brown fox</p>
      <p className="m-0 text-h2 text-[var(--color-text-primary)]">Heading 2 — The quick brown fox</p>
      <p className="m-0 text-h3 text-[var(--color-text-primary)]">Heading 3 — The quick brown fox</p>
      <p className="m-0 text-body text-[var(--color-text-primary)]">Body — Designing systems that agents and humans trust.</p>
      <p className="m-0 text-body-sm text-[var(--color-text-primary)]">Body small — Smaller supporting text and metadata.</p>
      <p className="m-0 text-caption text-[var(--color-text-primary)]">Caption — Captions and fine print.</p>
      <p className="m-0 text-mono text-[var(--color-text-primary)]">Mono — const token = "var(--color-primary)";</p>
    </div>
  ),
};

export const Fonts: Story = {
  render: () => (
    <div style={wrap}>
      <p className="m-0 font-[var(--font-display)] text-[28px] text-[var(--color-text-primary)]">Sora — Display</p>
      <p className="m-0 font-[var(--font-ui)] text-[18px] text-[var(--color-text-primary)]">Inter — UI</p>
      <p className="m-0 font-[var(--font-mono)] text-[16px] text-[var(--color-text-primary)]">JetBrains Mono — Code</p>
    </div>
  ),
};
