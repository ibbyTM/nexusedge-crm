/**
 * The only place the browser talks to the PHP API. Same-origin relative
 * fetches in production (static export and PHP on one host); during
 * `next dev` set NEXT_PUBLIC_API_BASE=http://127.0.0.1:8080 and list
 * http://localhost:3000 in APP_ORIGINS in server/config.php.
 */

import type {
	AutomationButton,
	AutomationRun,
	Contact,
	ContactsPage,
	Location,
	LocationMeta,
	Note,
	RunResult,
	SyncState,
	Task,
	User,
	WebhookEvent,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export class ApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
	const url = `${API_BASE}/api/${path}`;
	if (!query) return url;
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null || value === "") continue;
		params.set(key, String(value));
	}
	const qs = params.toString();
	return qs ? `${url}?${qs}` : url;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
	onUnauthorized = handler;
}

async function request<T>(method: string, path: string, options: { query?: Query; body?: unknown; silent401?: boolean } = {}): Promise<T> {
	let res: Response;
	try {
		res = await fetch(buildUrl(path, options.query), {
			method,
			headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
			body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
			credentials: API_BASE ? "include" : "same-origin",
		});
	} catch {
		throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
	}
	const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
	if (!res.ok) {
		if (res.status === 401 && !options.silent401 && onUnauthorized) onUnauthorized();
		throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
	}
	return data as T;
}

export const api = {
	auth: {
		login: (email: string, password: string) => request<{ success: true; user: User }>("POST", "auth/login", { body: { email, password }, silent401: true }),
		logout: () => request<{ success: true }>("POST", "auth/logout"),
		me: () => request<{ user: User }>("GET", "auth/me", { silent401: true }),
	},
	locations: {
		list: (all = false) => request<{ locations: Location[] }>("GET", "locations", { query: { all: all ? 1 : undefined } }),
		setEnabled: (id: string, enabled: boolean) => request<{ success: true }>("PUT", "locations", { body: { id, enabled } }),
	},
	meta: (locationId: string) => request<LocationMeta>("GET", "meta", { query: { locationId } }),
	contacts: {
		list: (query: Query) => request<ContactsPage>("GET", "contacts", { query }),
		create: (body: Record<string, unknown>) => request<{ contact: Contact }>("POST", "contacts", { body }),
		get: (id: string, refresh = false) =>
			request<{ contact: Contact; notes: Note[]; tasks: Task[]; runs: AutomationRun[]; warning: string | null }>("GET", "contact", { query: { id, refresh: refresh ? 1 : undefined } }),
		update: (id: string, fields: Record<string, unknown>) => request<{ contact: Contact }>("PUT", "contact", { body: { id, ...fields } }),
		remove: (id: string) => request<{ success: true }>("DELETE", "contact", { body: { id } }),
		tags: (id: string, add: string[], remove: string[]) => request<{ contact: Contact }>("POST", "contact/tags", { body: { id, add, remove } }),
		addNote: (id: string, body: string) => request<{ notes: Note[] }>("POST", "contact/notes", { body: { id, body } }),
		bulkTags: (ids: string[], add: string[], remove: string[]) =>
			request<{ results: { id: string; ok: boolean; error?: string }[] }>("POST", "contacts/bulk-tags", { body: { ids, add, remove } }),
	},
	automations: {
		buttons: (locationId?: string, all = false) => request<{ buttons: AutomationButton[]; icons: string[] }>("GET", "automations/buttons", { query: { locationId, all: all ? 1 : undefined } }),
		createButton: (body: Record<string, unknown>) => request<{ button: AutomationButton }>("POST", "automations/buttons", { body }),
		updateButton: (id: string, body: Record<string, unknown>) => request<{ button: AutomationButton }>("PUT", "automations/buttons", { body: { id, ...body } }),
		deleteButton: (id: string) => request<{ success: true }>("DELETE", "automations/buttons", { body: { id } }),
		run: (buttonId: string, contactIds: string[]) => request<{ results: RunResult[]; succeeded: number; failed: number }>("POST", "automations/run", { body: { buttonId, contactIds } }),
		runs: (query: Query) => request<{ runs: AutomationRun[]; total: number; page: number; pageSize: number }>("GET", "automations/runs", { query }),
	},
	sync: {
		status: () => request<{ states: SyncState[]; recentWebhooks: WebhookEvent[] }>("GET", "sync"),
		step: (body: { step: "locations" | "meta" | "contacts"; locationId?: string; pages?: number; restart?: boolean }) =>
			request<{ step: string; done: boolean; synced: number | Record<string, unknown>; total?: number }>("POST", "sync", { body }),
	},
	team: {
		list: () => request<{ users: User[] }>("GET", "team"),
		create: (body: { email: string; name: string; password: string; role: string }) => request<{ user: User }>("POST", "team", { body }),
		update: (id: string, body: Record<string, unknown>) => request<{ user: User }>("PUT", "team", { body: { id, ...body } }),
		remove: (id: string) => request<{ success: true }>("DELETE", "team", { body: { id } }),
	},
};

export function errorMessage(error: unknown, fallback = "Something went wrong. Try again."): string {
	if (error instanceof ApiError) return error.message;
	if (error instanceof Error && error.message) return error.message;
	return fallback;
}
