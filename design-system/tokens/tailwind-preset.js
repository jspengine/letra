/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          amber: "var(--letra-amber-500)",
          slate: "var(--letra-slate-900)",
          emerald: "var(--letra-emerald-500)",
          blue: "var(--letra-blue-500)",
          red: "var(--letra-red-500)",
          purple: "var(--letra-purple-500)",
        },
        background: "var(--brand-background)",
        foreground: "var(--brand-text)",
        surface: "var(--brand-surface)",
        border: "var(--brand-border)",
        success: "var(--brand-success)",
        info: "var(--brand-info)",
        danger: "var(--brand-danger)",
      },
      fontFamily: {
        brand: ["Sora", "Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        glow: "var(--shadow-glow)",
        card: "var(--shadow-card)",
      },
      transitionTimingFunction: {
        brand: "var(--motion-emphasis)",
      },
      transitionDuration: {
        fast: "var(--motion-fast)",
        base: "var(--motion-base)",
        slow: "var(--motion-slow)",
      },
    },
  },
};
