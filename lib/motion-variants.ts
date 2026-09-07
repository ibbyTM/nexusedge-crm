import type { Variants } from "motion/react";

// The easing curve every entrance animation sitewide already used
// (previously hand-copied into ~21 files independently) — one definition now.
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// Shared container/item pair for whileInView section entrances. Adds `scale`
// (previously unused anywhere on the site) alongside the existing opacity+y,
// and widens the travel slightly (16px -> 20px) — still the same family of
// motion, just with a bit more presence.
export const sectionContainer: Variants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.1 } },
};

export const sectionItem: Variants = {
	hidden: { opacity: 0, y: 20, scale: 0.96 },
	show: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { duration: 0.5, ease: EASE_OUT_EXPO },
	},
};
