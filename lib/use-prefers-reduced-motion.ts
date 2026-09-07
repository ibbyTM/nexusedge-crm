"use client";

import { useEffect, useState } from "react";

// motion's own useReducedMotion() queries `(prefers-reduced-motion)` with no
// value, which some Chrome/Edge builds always match regardless of the actual
// OS setting — check the real query directly instead.
export function usePrefersReducedMotion() {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		// eslint-disable-next-line react-hooks/set-state-in-effect -- required to read the real media query on mount
		setPrefersReducedMotion(query.matches);
		const listener = (event: MediaQueryListEvent) =>
			setPrefersReducedMotion(event.matches);
		query.addEventListener("change", listener);
		return () => query.removeEventListener("change", listener);
	}, []);

	return prefersReducedMotion;
}
