import type { HTMLAttributes } from "react";
import { cn } from "./utils";
import { Icon } from "./icon";
import type { IconName } from "./icon";

type Variant = "amber" | "success" | "info" | "error" | "agent";
type Tone = "solid" | "soft" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: Variant;
	tone?: Tone;
	icon?: IconName;
}

const variantTokens: Record<Variant, { color: string; onColor: string; softColor: string; softBg: string; softBorder: string; outlineBorder: string; solidBg: string }> = {
	amber: { color: "var(--color-primary)", onColor: "var(--color-on-accent)", softColor: "#FFB800", softBg: "#1C1808", softBorder: "#5C4F1A", outlineBorder: "#8B7A25", solidBg: "var(--color-primary)" },
	success: { color: "var(--color-success)", onColor: "var(--color-on-status)", softColor: "#4ADE80", softBg: "#1A2B20", softBorder: "#244A33", outlineBorder: "#2D6A45", solidBg: "#178640" },
	info: { color: "var(--color-info)", onColor: "var(--color-on-status)", softColor: "#93C5FD", softBg: "#1C2636", softBorder: "#2B4264", outlineBorder: "#3B5E8A", solidBg: "#2858A7" },
	error: { color: "var(--color-danger)", onColor: "var(--color-on-status)", softColor: "#F87171", softBg: "#2C1A1A", softBorder: "#542626", outlineBorder: "#7A3636", solidBg: "#A22E2E" },
	agent: { color: "var(--color-agent)", onColor: "var(--color-on-status)", softColor: "#C4B5FD", softBg: "#22203A", softBorder: "#3C3568", outlineBorder: "#564D96", solidBg: "#7260AA" },
};

const variantIcons: Record<Variant, IconName> = {
	amber: "clock",
	success: "circle-check",
	info: "info",
	error: "circle-x",
	agent: "sparkles",
};

function badgeColors(variant: Variant, tone: Tone) {
	const tokens = variantTokens[variant];
	if (tone === "outline") {
		return {
			background: "transparent",
			color: tokens.softColor,
			borderColor: tokens.outlineBorder,
		};
	}
	if (tone === "soft") {
		return {
			background: tokens.softBg,
			color: tokens.softColor,
			borderColor: tokens.softBorder,
		};
	}
	return {
		background: tokens.solidBg,
		color: tokens.onColor,
		borderColor: tokens.solidBg,
	};
}

export function Badge({
	variant = "amber",
	tone = "solid",
	icon,
	className,
	children,
	style,
	...props
}: BadgeProps) {
	const colors = badgeColors(variant, tone);
	const resolvedIcon = icon ?? variantIcons[variant];
	return (
		<span
			className={cn(
				"inline-flex items-center gap-[var(--space-1)] text-caption font-medium px-[var(--space-2)] py-[var(--space-1)] rounded-[var(--radius-full)] border-[length:var(--border-thin)]",
				className,
			)}
			style={{ ...colors, ...style }}
			{...props}
		>
			<Icon name={resolvedIcon} size={12} />
			{children}
		</span>
	);
}
