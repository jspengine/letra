import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Foundations/Motion",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    "x-ds": {
      category: "foundation",
      status: "ready",
      tokens: ["duration-fast", "motion-fast", "motion-base", "motion-slow", "ease-standard", "color-agent"],
      consumes: [],
      surfaces: ["Storybook"],
      a11y: ["reduced-motion-aware", "token-labels"],
      breakpoints: ["mobile", "desktop"],
    },
  },
};

export default meta;

type Story = StoryObj;

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
  padding: 24,
  maxWidth: 720,
};

const Token = ({ token, value, label }: { token: string; value: string; label: string }) => (
  <div className="flex items-center gap-[var(--space-3)] py-[var(--space-1)]">
    <span className="w-[150px] font-semibold text-[var(--color-text-primary)]">{label}</span>
    <code className="text-[13px] text-[var(--color-text-secondary)]">{token}</code>
    <code className="ml-[var(--space-2)] text-[12px] text-[var(--color-text-disabled)]">{value}</code>
  </div>
);

const Box = ({ label, animationClassName, tone = "primary" }: { label: string; animationClassName: string; tone?: "primary" | "agent" | "danger" | "success" }) => (
  <div className="flex flex-col items-center gap-[var(--space-2)]">
    <div
      className={`size-[80px] rounded-[var(--radius-md)] ${animationClassName}`}
      style={{
        background:
          tone === "agent" ? "var(--color-agent)" :
          tone === "danger" ? "var(--color-danger)" :
          tone === "success" ? "var(--color-success)" :
          "var(--color-primary)",
      }}
    />
    <code className="text-[12px] text-[var(--color-text-secondary)]">{label}</code>
  </div>
);

export const Tokens: Story = {
  render: () => (
    <div style={wrap}>
      <Token token="--duration-fast" value="180ms" label="duration-fast" />
      <Token token="--motion-fast" value="140ms" label="motion-fast" />
      <Token token="--motion-base" value="180ms" label="motion-base" />
      <Token token="--motion-slow" value="280ms" label="motion-slow" />
      <Token token="--ease-standard" value="cubic-bezier(0.2,0.8,0.2,1)" label="ease-standard" />
      <div className="grid grid-cols-4 gap-[var(--space-6)] py-[var(--space-4)]">
        <Box label="agent-running" animationClassName="animate-agent-running" tone="agent" />
        <Box label="agent-breathe" animationClassName="animate-agent-breathe" tone="agent" />
        <Box label="pulse-gate-waiting" animationClassName="animate-pulse-gate-waiting" />
        <Box label="pulse-gate-urgent" animationClassName="animate-pulse-gate-urgent" tone="danger" />
        <Box label="shimmer-slide" animationClassName="animate-shimmer-slide" />
        <Box label="timeline-dot" animationClassName="animate-timeline-dot" />
        <Box label="human-pulse" animationClassName="animate-human-pulse" />
        <Box label="slide-up" animationClassName="animate-slide-up" tone="success" />
        <Box label="progress-stripes" animationClassName="animate-progress-stripes" />
        <Box label="drift-pulse" animationClassName="animate-drift-pulse" />
        <Box label="validating-bar" animationClassName="animate-validating-bar" />
      </div>
      <p className="m-0 text-[13px] text-[var(--color-text-secondary)]">
        Animações respeitam <code>prefers-reduced-motion</code>. Valide no app com a acessibilidade
        do SO ativada.
      </p>
    </div>
  ),
};
