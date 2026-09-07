export function formatDate(iso: string | null | undefined): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return d.toLocaleString("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(iso: string | null | undefined): string {
	if (!iso) return "never";
	const t = new Date(iso).getTime();
	if (Number.isNaN(t)) return "";
	const seconds = Math.round((Date.now() - t) / 1000);
	if (seconds < 45) return "just now";
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} h ago`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days} d ago`;
	return formatDate(iso);
}

export function contactDisplayName(c: { name: string | null; firstName: string | null; lastName: string | null; email: string | null; phone: string | null }): string {
	const full = (c.name || `${c.firstName ?? ""} ${c.lastName ?? ""}`).trim();
	return full || c.email || c.phone || "Unnamed contact";
}

export function initials(name: string): string {
	const parts = name.split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function highLevelContactUrl(locationId: string, contactId: string): string {
	return `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
}

export function highLevelLocationUrl(locationId: string): string {
	return `https://app.gohighlevel.com/v2/location/${locationId}/dashboard`;
}
