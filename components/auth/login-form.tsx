"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogoMark } from "@/components/logo-mark";
import { Field, InlineError } from "@/components/crm/primitives";

export function LoginForm() {
	const router = useRouter();
	const params = useSearchParams();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [shake, setShake] = useState(false);
	const shakeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		// Already signed in? Skip the form.
		api.auth.me().then(() => router.replace(safeNext(params.get("next")))).catch(() => undefined);
		return () => {
			if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
		};
	}, [router, params]);

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		setSubmitting(true);
		setError(null);
		try {
			await api.auth.login(email.trim(), password);
			router.replace(safeNext(params.get("next")));
		} catch (err) {
			setError(errorMessage(err));
			setShake(true);
			shakeTimeout.current = setTimeout(() => setShake(false), 500);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className={`w-full max-w-sm ${shake ? "passcode-shake" : ""}`}>
			<div className="mb-8 flex flex-col items-center gap-4 text-center">
				<span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
					<LogoMark animate className="size-6" />
				</span>
				<div>
					<h1 className="font-heading font-medium text-xl">
						Nexus<span className="text-primary">Edge</span> CRM
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">Sign in with your team account.</p>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border bg-card p-6">
				<Field label="Email" htmlFor="email">
					<Input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
				</Field>
				<Field label="Password" htmlFor="password">
					<Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
				</Field>
				<InlineError message={error} />
				<Button type="submit" size="lg" disabled={submitting} className="w-full">
					{submitting ? "Signing in" : "Sign in"}
					{!submitting && <ArrowRightIcon data-icon="inline-end" />}
				</Button>
			</form>
		</div>
	);
}

function safeNext(next: string | null): string {
	if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return "/";
	return next;
}
