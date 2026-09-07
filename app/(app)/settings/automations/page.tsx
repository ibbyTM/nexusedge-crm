import type { Metadata } from "next";

import { AutomationButtonsSettings } from "@/components/crm/settings-automations";

export const metadata: Metadata = { title: "Automation buttons" };

export default function SettingsAutomationsPage() {
	return <AutomationButtonsSettings />;
}
