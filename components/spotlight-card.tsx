"use client";

import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SpotlightCard({
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
		el.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
		el.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
	}, []);

	return (
		<div
			ref={ref}
			onPointerMove={handlePointerMove}
			className={cn("spotlight-card", className)}
		>
			{children}
		</div>
	);
}
