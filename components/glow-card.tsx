"use client";

import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const PROXIMITY = 90;
const FADE_DISTANCE = 160;

export function GlowCard({
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
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const centerX = rect.width / 2;
		const centerY = rect.height / 2;
		const distance = Math.hypot(x - centerX, y - centerY);

		let intensity = 0;
		if (distance <= PROXIMITY) intensity = 1;
		else if (distance <= FADE_DISTANCE) {
			intensity = (FADE_DISTANCE - distance) / (FADE_DISTANCE - PROXIMITY);
		}

		el.style.setProperty("--glow-x", `${(x / rect.width) * 100}%`);
		el.style.setProperty("--glow-y", `${(y / rect.height) * 100}%`);
		el.style.setProperty("--glow-intensity", intensity.toString());
	}, []);

	const handlePointerLeave = useCallback(() => {
		ref.current?.style.setProperty("--glow-intensity", "0");
	}, []);

	return (
		<div
			ref={ref}
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
			className={cn("glow-card", className)}
		>
			{children}
		</div>
	);
}
