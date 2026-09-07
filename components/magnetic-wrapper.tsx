"use client";

import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// Same imperative CSS-variable pattern as tilt-card/glow-card/spotlight-card
// — no React state, no re-render per pointer move.
const STRENGTH = 0.35;
const MAX_OFFSET = 10; // px — keeps the pull subtle, not a cartoonish lunge

export function MagneticWrapper({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);

	const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
		const el = ref.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		const offsetX = Math.max(
			Math.min((event.clientX - centerX) * STRENGTH, MAX_OFFSET),
			-MAX_OFFSET
		);
		const offsetY = Math.max(
			Math.min((event.clientY - centerY) * STRENGTH, MAX_OFFSET),
			-MAX_OFFSET
		);

		el.style.setProperty("--magnetic-x", `${offsetX}px`);
		el.style.setProperty("--magnetic-y", `${offsetY}px`);
	}, []);

	const handlePointerLeave = useCallback(() => {
		const el = ref.current;
		if (!el) return;
		el.style.setProperty("--magnetic-x", "0px");
		el.style.setProperty("--magnetic-y", "0px");
	}, []);

	return (
		<div
			ref={ref}
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
			className={cn("magnetic-wrapper", className)}
		>
			{children}
		</div>
	);
}
