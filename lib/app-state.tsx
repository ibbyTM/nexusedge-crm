"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { api, setUnauthorizedHandler } from "@/lib/api";
import type { Location, LocationMeta, User } from "@/lib/types";

const LOCATION_KEY = "ne-crm-location";

type AppState = {
	user: User | null;
	locations: Location[];
	location: Location | null;
	meta: LocationMeta | null;
	metaLoading: boolean;
	setLocationId: (id: string) => void;
	refreshLocations: () => Promise<void>;
	refreshMeta: () => Promise<void>;
	logout: () => Promise<void>;
};

const AppStateContext = createContext<AppState | null>(null);

function readStoredLocation(): string | null {
	try {
		return window.localStorage.getItem(LOCATION_KEY);
	} catch {
		return null;
	}
}

function storeLocation(id: string) {
	try {
		window.localStorage.setItem(LOCATION_KEY, id);
	} catch {
		// Storage can be unavailable (private mode); the switcher still works for the session.
	}
}

/**
 * Loads the session, the sub-account list and the selected sub-account's
 * metadata. A 401 anywhere sends the user to /login; the static export has no
 * server-side guard, so this is the guard.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const pathname = usePathname();
	const [user, setUser] = useState<User | null>(null);
	const [ready, setReady] = useState(false);
	const [locations, setLocations] = useState<Location[]>([]);
	const [locationId, setLocationIdState] = useState<string | null>(null);
	const [meta, setMeta] = useState<LocationMeta | null>(null);
	const [metaLoading, setMetaLoading] = useState(false);

	const goToLogin = useCallback(() => {
		const next = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
		router.replace(`/login${next}`);
	}, [router, pathname]);

	useEffect(() => {
		setUnauthorizedHandler(goToLogin);
		return () => setUnauthorizedHandler(null);
	}, [goToLogin]);

	const refreshLocations = useCallback(async () => {
		const { locations: list } = await api.locations.list();
		setLocations(list);
		setLocationIdState((current) => {
			const stored = current ?? readStoredLocation();
			if (stored && list.some((l) => l.id === stored)) return stored;
			return list[0]?.id ?? null;
		});
	}, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const { user: me } = await api.auth.me();
				if (cancelled) return;
				setUser(me);
				await refreshLocations();
			} catch {
				if (!cancelled) goToLogin();
				return;
			} finally {
				if (!cancelled) setReady(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [refreshLocations, goToLogin]);

	const refreshMeta = useCallback(async () => {
		if (!locationId) {
			setMeta(null);
			return;
		}
		setMetaLoading(true);
		try {
			setMeta(await api.meta(locationId));
		} catch {
			setMeta(null);
		} finally {
			setMetaLoading(false);
		}
	}, [locationId]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount; state is set after the request resolves
		void refreshMeta();
	}, [refreshMeta]);

	const setLocationId = useCallback((id: string) => {
		storeLocation(id);
		setLocationIdState(id);
	}, []);

	const logout = useCallback(async () => {
		try {
			await api.auth.logout();
		} finally {
			setUser(null);
			router.replace("/login");
		}
	}, [router]);

	const value = useMemo<AppState>(
		() => ({
			user,
			locations,
			location: locations.find((l) => l.id === locationId) ?? null,
			meta,
			metaLoading,
			setLocationId,
			refreshLocations,
			refreshMeta,
			logout,
		}),
		[user, locations, locationId, meta, metaLoading, setLocationId, refreshLocations, refreshMeta, logout]
	);

	if (!ready || !user) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">Loading</p>
			</div>
		);
	}

	return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
	const ctx = useContext(AppStateContext);
	if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
	return ctx;
}
