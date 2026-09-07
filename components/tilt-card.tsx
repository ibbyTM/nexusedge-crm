"use client";

import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

function clamp(value: number, min = 0, max = 100) {
	return Math.min(Math.max(value, min), max);
}

export function TiltCard({
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
		const percentX = clamp((100 / rect.width) * x);
		const percentY = clamp((100 / rect.height) * y);
		const centerX = percentX - 50;
		const centerY = percentY - 50;

		el.style.setProperty("--pointer-x", `${percentX}%`);
		el.style.setProperty("--pointer-y", `${percentY}%`);
		el.style.setProperty("--rotate-x", `${(-centerX / 14).toFixed(2)}deg`);
		el.style.setProperty("--rotate-y", `${(centerY / 10).toFixed(2)}deg`);
	}, []);

	const handlePointerLeave = useCallback(() => {
		const el = ref.current;
		if (!el) return;
		el.style.setProperty("--pointer-x", "50%");
		el.style.setProperty("--pointer-y", "50%");
		el.style.setProperty("--rotate-x", "0deg");
		el.style.setProperty("--rotate-y", "0deg");
	}, []);

	return (
		<div
			ref={ref}
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
			className={cn("tilt-card", className)}
		>
			<div className="tilt-card-inner">
				<div aria-hidden="true" className="tilt-card-glare" />
				{children}
			</div>
		</div>
	);
}
