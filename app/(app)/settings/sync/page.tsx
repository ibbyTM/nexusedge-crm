import type { Metadata } from "next";

import { SyncSettings } from "@/components/crm/settings-sync";

export const metadata: Metadata = { title: "Sync and webhooks" };

export default function SettingsSyncPage() {
	return <SyncSettings />;
}
