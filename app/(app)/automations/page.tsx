import type { Metadata } from "next";

import { AutomationRuns } from "@/components/crm/automation-runs";

export const metadata: Metadata = { title: "Automation runs" };

export default function AutomationRunsPage() {
	return <AutomationRuns />;
}
