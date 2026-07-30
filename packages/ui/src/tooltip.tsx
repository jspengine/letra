import { type CSSProperties, type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "./utils";

interface TooltipProps {
	content: string;
	children: ReactNode;
	position?: "top" | "bottom" | "left" | "right";
	className?: string;
}

export function Tooltip({ content, children, position = "top", className }: TooltipProps) {
	const [visible, setVisible] = useState(false);
	const [anchor, setAnchor] = useState<DOMRect | null>(null);
	const wrapperRef = useRef<HTMLDivElement | null>(null);

	function show() {
		setAnchor(wrapperRef.current?.getBoundingClientRect() ?? null);
		setVisible(true);
	}

	function tooltipStyle(): CSSProperties {
		if (!anchor) return {};
		const gap = 8;
		if (position === "right") {
			return { left: anchor.right + gap, top: anchor.top + anchor.height / 2, transform: "translateY(-50%)" };
		}
		if (position === "left") {
			return { left: anchor.left - gap, top: anchor.top + anchor.height / 2, transform: "translate(-100%, -50%)" };
		}
		if (position === "bottom") {
			return { left: anchor.left + anchor.width / 2, top: anchor.bottom + gap, transform: "translateX(-50%)" };
		}
		return { left: anchor.left + anchor.width / 2, top: anchor.top - gap, transform: "translate(-50%, -100%)" };
	}

	return (
		<div
			ref={wrapperRef}
			className={cn("relative inline-flex", className)}
			onMouseEnter={show}
			onMouseLeave={() => setVisible(false)}
			onFocus={show}
			onBlur={() => setVisible(false)}
		>
			{children}
			{visible && typeof document !== "undefined" ? createPortal(
				<div
					className={cn(
						"fixed z-[var(--z-tooltip)] px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs whitespace-nowrap pointer-events-none",
					)}
					style={{
						...tooltipStyle(),
						background: "var(--foreground)",
						color: "var(--background)",
					}}
					role="tooltip"
				>
					{content}
				</div>,
				document.body,
			) : null}
		</div>
	);
}
