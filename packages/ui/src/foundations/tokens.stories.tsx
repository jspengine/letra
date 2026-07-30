import type { Meta, StoryObj } from "@storybook/react";

import { Swatch, Bar } from "./token-components";

const meta: Meta = {
  title: "Foundations/Tokens",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    "x-ds": {
      category: "foundation",
      status: "ready",
      tokens: ["color-primary", "color-bg-base", "color-border", "radius-md", "space-4", "layout-page-gap", "card-padding"],
      consumes: ["Swatch", "Bar"],
      surfaces: ["Storybook"],
      a11y: ["token-labels", "visual-and-text-values"],
      breakpoints: ["mobile", "desktop"],
    },
  },
};

export default meta;

type Story = StoryObj;

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 28,
  padding: 24,
  maxWidth: 880,
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 4,
};

export const Colors: Story = {
  render: () => (
    <div style={wrap}>
      <section>
        <h3 className="mb-[var(--space-2)] text-h3 text-[var(--color-text-primary)]">Superfícies & Texto</h3>
        <div style={row}>
          <Swatch token="--color-bg-base" label="bg-base" />
          <Swatch token="--color-bg-surface" label="bg-surface" />
          <Swatch token="--color-bg-sunken" label="bg-sunken" />
          <Swatch token="--color-border" label="border" />
          <Swatch token="--color-text-primary" label="text-primary" text />
          <Swatch token="--color-text-secondary" label="text-secondary" text />
          <Swatch token="--color-text-disabled" label="text-disabled" text />
        </div>
      </section>

      <section>
        <h3 className="mb-[var(--space-2)] text-h3 text-[var(--color-text-primary)]">Marca & Semânticas</h3>
        <div style={row}>
          <Swatch token="--color-primary" label="primary" />
          <Swatch token="--color-primary-hover" label="primary-hover" />
          <Swatch token="--color-primary-pressed" label="primary-pressed" />
          <Swatch token="--color-agent" label="agent" />
          <Swatch token="--color-success" label="success" />
          <Swatch token="--color-info" label="info" />
          <Swatch token="--color-danger" label="danger" />
          <Swatch token="--color-warning" label="warning" />
        </div>
      </section>

      <section>
        <h3 className="mb-[var(--space-2)] text-h3 text-[var(--color-text-primary)]">Sidebar</h3>
        <div style={row}>
          <Swatch token="--color-sidebar" label="sidebar" />
          <Swatch token="--color-sidebar-accent" label="sidebar-accent" />
          <Swatch token="--color-sidebar-border" label="sidebar-border" />
          <Swatch token="--color-sidebar-ring" label="sidebar-ring" />
        </div>
      </section>
    </div>
  ),
};

export const Radius: Story = {
  render: () => (
    <div style={wrap}>
      <h3 className="mb-[var(--space-2)] text-h3 text-[var(--color-text-primary)]">Raio</h3>
      <div style={row}>
        <Bar token="--radius-xs" value="6px" label="radius-xs" />
        <Bar token="--radius-sm" value="8px" label="radius-sm" />
        <Bar token="--radius-md" value="12px" label="radius-md" />
        <Bar token="--radius-lg" value="16px" label="radius-lg" />
        <Bar token="--radius-xl" value="20px" label="radius-xl" />
        <Bar token="--radius-full" value="9999px" label="radius-full" />
      </div>
    </div>
  ),
};

export const Spacing: Story = {
  render: () => (
    <div style={wrap}>
      <section>
        <h3 className="mb-[var(--space-2)] text-h3 text-[var(--color-text-primary)]">Escala base</h3>
        <div style={row}>
          <Bar token="--space-1" value="4px" label="space-1" />
          <Bar token="--space-2" value="8px" label="space-2" />
          <Bar token="--space-3" value="12px" label="space-3" />
          <Bar token="--space-4" value="16px" label="space-4" />
          <Bar token="--space-6" value="24px" label="space-6" />
          <Bar token="--space-8" value="32px" label="space-8" />
          <Bar token="--space-12" value="48px" label="space-12" />
          <Bar token="--space-16" value="64px" label="space-16" />
        </div>
      </section>

      <section>
        <h3 className="mb-[var(--space-2)] text-h3 text-[var(--color-text-primary)]">Espaçamento semântico</h3>
        <div style={row}>
          <Bar token="--layout-page-padding" value="clamp(16px, 2vw, 32px)" label="page-padding" />
          <Bar token="--layout-page-gap" value="24px" label="page-gap" />
          <Bar token="--layout-section-gap" value="20px" label="section-gap" />
          <Bar token="--layout-panel-gap" value="16px" label="panel-gap" />
          <Bar token="--layout-cluster-gap" value="12px" label="cluster-gap" />
          <Bar token="--layout-list-gap" value="12px" label="list-gap" />
          <Bar token="--layout-list-item-padding" value="16px" label="list-item-padding" />
          <Bar token="--card-padding" value="20px" label="card-padding" />
          <Bar token="--card-content-gap" value="16px" label="card-content-gap" />
          <Bar token="--form-field-gap" value="8px" label="form-field-gap" />
          <Bar token="--form-section-gap" value="20px" label="form-section-gap" />
        </div>
      </section>
    </div>
  ),
};
