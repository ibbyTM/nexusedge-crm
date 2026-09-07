export type Role = "admin" | "member";

export type User = {
	id: string;
	email: string;
	name: string;
	role: Role;
	createdAt: string;
	lastLoginAt: string | null;
};

export type Location = {
	id: string;
	name: string;
	city: string | null;
	country: string | null;
	timezone: string | null;
	website: string | null;
	enabled: boolean;
	contactCount: number;
	syncedAt: string | null;
};

export type CustomFieldValue = { id: string; value: unknown };

export type Contact = {
	id: string;
	locationId: string;
	firstName: string | null;
	lastName: string | null;
	name: string | null;
	email: string | null;
	phone: string | null;
	companyName: string | null;
	address1: string | null;
	city: string | null;
	state: string | null;
	country: string | null;
	postalCode: string | null;
	website: string | null;
	timezone: string | null;
	source: string | null;
	assignedTo: string | null;
	dnd: boolean;
	dndSettings: Record<string, { status?: string; message?: string }> | null;
	tags: string[];
	customFields: CustomFieldValue[];
	dateAdded: string | null;
	dateUpdated: string | null;
	lastActivity: string | null;
	syncedAt: string;
};

export type Note = { id: string; userId: string | null; body: string; dateAdded: string | null };
export type Task = {
	id: string;
	title: string | null;
	body: string | null;
	assignedTo: string | null;
	dueDate: string | null;
	completed: boolean;
};

export type CustomField = {
	id: string;
	name: string;
	fieldKey: string | null;
	dataType: string | null;
	placeholder: string | null;
	position: number;
	picklistOptions: string[] | null;
};

export type Workflow = {
	id: string;
	name: string;
	status: string | null;
	version: number | null;
	updatedAt: string | null;
};

export type LocationUser = { id: string; name: string | null; email: string | null; role: string | null };

export type Mechanism = "workflow" | "webhook" | "tag";

export type AutomationButton = {
	id: string;
	locationId: string | null;
	label: string;
	description: string | null;
	icon: string;
	mechanism: Mechanism;
	workflowId: string | null;
	webhookUrl: string | null;
	tagName: string | null;
	payloadTemplate: string | null;
	minRole: Role;
	confirmText: string | null;
	sortOrder: number;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
};

export type AutomationRun = {
	id: string;
	buttonId: string | null;
	buttonLabel: string;
	mechanism: Mechanism;
	locationId: string;
	contactId: string | null;
	contactName: string | null;
	userId: string;
	userName: string;
	status: "success" | "failed";
	responseCode: number | null;
	detail: string | null;
	createdAt: string;
};

export type RunResult = {
	runId?: string;
	contactId: string;
	status: "success" | "failed";
	responseCode: number | null;
	detail: string | null;
};

export type SyncState = {
	locationId: string;
	resource: string;
	status: "idle" | "running" | "done" | "error";
	itemsSynced: number;
	lastStartedAt: string | null;
	lastFinishedAt: string | null;
	lastError: string | null;
};

export type WebhookEvent = {
	id: string;
	type: string | null;
	source: "app" | "workflow";
	locationId: string | null;
	contactId: string | null;
	receivedAt: string;
	processed: boolean;
	error: string | null;
};

export type LocationMeta = {
	tags: { id: string; name: string }[];
	customFields: CustomField[];
	users: LocationUser[];
	workflows: Workflow[];
	tagCounts: { tag: string; count: number }[];
	buttons: AutomationButton[];
	sync: { contacts: RawSyncState; meta: RawSyncState };
};

export type RawSyncState = {
	location_id: string;
	resource: string;
	status: "idle" | "running" | "done" | "error";
	items_synced: number | string;
	last_started_at: string | null;
	last_finished_at: string | null;
	last_error: string | null;
};

export type ContactsPage = { contacts: Contact[]; total: number; page: number; pageSize: number };
