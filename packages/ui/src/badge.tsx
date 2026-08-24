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

const variantTokens: Record<Variant, { color: string; onColor: string; softColor: string }> = {
	amber: { color: "var(--color-primary)", onColor: "var(--color-on-accent)", softColor: "var(--color-primary)" },
	success: { color: "var(--color-success)", onColor: "var(--color-on-status)", softColor: "var(--color-success)" },
	info: { color: "var(--color-info)", onColor: "var(--color-on-status)", softColor: "#60A5FA" },
	error: { color: "var(--color-danger)", onColor: "var(--color-on-status)", softColor: "var(--color-danger)" },
	agent: { color: "var(--color-agent)", onColor: "var(--color-on-status)", softColor: "#A78BFA" },
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
			borderColor: `color-mix(in oklch, ${tokens.softColor} 48%, transparent)`,
		};
	}
	if (tone === "soft") {
		return {
			background: `color-mix(in oklch, ${tokens.softColor} 14%, transparent)`,
			color: tokens.softColor,
			borderColor: `color-mix(in oklch, ${tokens.softColor} 36%, transparent)`,
		};
	}
	return {
		background:
			variant === "amber" ? tokens.color : `color-mix(in oklch, ${tokens.color} 68%, black)`,
		color: tokens.onColor,
		borderColor:
			variant === "amber" ? tokens.color : `color-mix(in oklch, ${tokens.color} 68%, black)`,
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
