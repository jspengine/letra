import type { CSSProperties } from "react";

export const Swatch = ({
	token,
	hex,
	label,
	text = false,
}: {
	token: string;
	hex?: string;
	label: string;
	text?: boolean;
}) => (
	<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
		<div
			style={{
				width: 56,
				height: 56,
				borderRadius: 10,
				background: text ? "transparent" : `var(${token})`,
				border: text ? "none" : "1px solid var(--color-border)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: `var(${token})`,
				fontFamily: "var(--font-mono)",
				fontSize: 11,
			}}
		>
			{text ? "Ag" : ""}
		</div>
		<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
			<span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{label}</span>
			<code style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>{token}</code>
			{hex ? (
				<code style={{ color: "var(--color-text-disabled)", fontSize: 11 }}>{hex}</code>
			) : null}
		</div>
	</div>
);

export const Bar = ({
	token,
	label,
	value,
}: {
	token: string;
	label: string;
	value: string;
}) => (
	<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
		<span style={{ width: 160, fontWeight: 600, color: "var(--color-text-primary)" }}>
			{label}
		</span>
		<div
			style={{
				flex: 1,
				height: 28,
				background: `var(${token})`,
				borderRadius: 6,
				border: "1px solid var(--color-border)",
			}}
		/>
		<code
			style={{
				width: 90,
				textAlign: "right",
				color: "var(--color-text-secondary)",
				fontSize: 12,
			}}
		>
			{value}
		</code>
	</div>
);
