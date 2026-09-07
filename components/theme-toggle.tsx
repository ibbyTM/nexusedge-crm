"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- required to avoid SSR/client theme mismatch
		setMounted(true);
	}, []);

	// If cookies were declined, don't let next-themes carry a remembered
	// preference into future visits - clear the key it just wrote every time
	// the resolved theme changes, rather than silently ignoring the choice.
	// Read localStorage directly (not via useCookieConsent) since that hook's
	// state is local to whichever component calls it - the banner declining
	// wouldn't otherwise be visible here.
	useEffect(() => {
		if (window.localStorage.getItem("cookie-consent") === "declined") {
			window.localStorage.removeItem("theme");
		}
	}, [resolvedTheme]);

	const toggleTheme = () => {
		const next = resolvedTheme === "dark" ? "light" : "dark";
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)"
		).matches;

		if (
			!document.startViewTransition ||
			prefersReducedMotion ||
			!buttonRef.current
		) {
			setTheme(next);
			return;
		}

		const { left, top, width, height } =
			buttonRef.current.getBoundingClientRect();
		const x = left + width / 2;
		const y = top + height / 2;
		const maxRadius = Math.hypot(
			Math.max(x, window.innerWidth - x),
			Math.max(y, window.innerHeight - y)
		);

		const transition = document.startViewTransition(() => {
			flushSync(() => setTheme(next));
		});

		transition.ready.then(() => {
			document.documentElement.animate(
				{
					clipPath: [
						`circle(0px at ${x}px ${y}px)`,
						`circle(${maxRadius}px at ${x}px ${y}px)`,
					],
				},
				{
					duration: 550,
					easing: "ease-in-out",
					pseudoElement: "::view-transition-new(root)",
				}
			);
		});
	};

	return (
		<Button
			ref={buttonRef}
			variant="ghost"
			size="icon"
			aria-label="Toggle theme"
			className={cn(className)}
			onClick={toggleTheme}
		>
			{mounted && resolvedTheme === "dark" ? (
				<SunIcon className="size-4" />
			) : (
				<MoonIcon className="size-4" />
			)}
		</Button>
	);
}
