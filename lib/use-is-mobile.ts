"use client";

import { useEffect, useState } from "react";

// Matches Tailwind's `md` breakpoint. Used to skip mounting heavy WebGL
// shader backgrounds on phones — real devices have weaker GPUs and tighter
// battery budgets than what this renders comfortably on in dev/desktop.
export function useIsMobile() {
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const query = window.matchMedia("(max-width: 767px)");
		// eslint-disable-next-line react-hooks/set-state-in-effect -- required to read the real media query on mount
		setIsMobile(query.matches);
		const listener = (event: MediaQueryListEvent) => setIsMobile(event.matches);
		query.addEventListener("change", listener);
		return () => query.removeEventListener("change", listener);
	}, []);

	return isMobile;
}
