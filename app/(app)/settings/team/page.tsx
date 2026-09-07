import type { Metadata } from "next";

import { TeamSettings } from "@/components/crm/settings-team";

export const metadata: Metadata = { title: "Team" };

export default function SettingsTeamPage() {
	return <TeamSettings />;
}
