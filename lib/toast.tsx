"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2Icon, CircleAlertIcon, XIcon } from "lucide-react";

import { EASE_OUT_EXPO } from "@/lib/motion-variants";

type Toast = { id: number; tone: "ok" | "bad"; title: string; detail?: string };
type ToastApi = { toast: (t: Omit<Toast, "id">) => void };

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

	const toast = useCallback(
		(t: Omit<Toast, "id">) => {
			const id = nextId++;
			setToasts((list) => [...list.slice(-3), { ...t, id }]);
			setTimeout(() => dismiss(id), t.tone === "bad" ? 8000 : 4500);
		},
		[dismiss]
	);

	const value = useMemo(() => ({ toast }), [toast]);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
				<AnimatePresence>
					{toasts.map((t) => (
						<motion.div
							key={t.id}
							layout
							initial={{ opacity: 0, y: 12, scale: 0.96 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 8, scale: 0.98 }}
							transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
							className="pointer-events-auto flex items-start gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/5"
						>
							{t.tone === "ok" ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />}
							<div className="min-w-0 flex-1">
								<p className="font-medium text-sm">{t.title}</p>
								{t.detail && <p className="mt-0.5 break-words text-muted-foreground text-xs">{t.detail}</p>}
							</div>
							<button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-md p-0.5 text-muted-foreground hover:text-foreground">
								<XIcon className="size-3.5" />
							</button>
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastApi {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used inside ToastProvider");
	return ctx;
}
