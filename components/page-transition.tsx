"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";

import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

// Raw client-side navigation on this static export measures ~30ms — nothing
// worth hiding behind a transition. This is just a quick fade-in on the new
// content (keyed by pathname so it remounts and replays on every route
// change) so a page swap doesn't read as a hard jump-cut. No exit animation:
// Next.js swaps `children` immediately on navigation regardless of animation
// timing, so there's no "old page" left to animate away by the time this
// re-renders — trying to fake one is what caused the wipe-overlay bugs in
// earlier iterations of this component.
export function PageTransition({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const prefersReducedMotion = usePrefersReducedMotion();

	if (prefersReducedMotion) {
		return <div className="flex flex-1 flex-col">{children}</div>;
	}

	return (
		<motion.div
			key={pathname}
			initial={{ opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.18, ease: "easeOut" }}
			className="flex flex-1 flex-col"
		>
			{children}
		</motion.div>
	);
}
